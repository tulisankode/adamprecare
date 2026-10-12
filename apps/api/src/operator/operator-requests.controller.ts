import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { Prisma, RequestStatus } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../common/app-error';
import { jakartaRange } from '../common/format';
import { ok, paged, paginationSchema, skipTake, success } from '../common/response';
import { dateOnlySchema, uuidSchema } from '../common/validators';
import { ZodPipe } from '../common/zod.pipe';
import { AuthUser, CurrentUser, Roles, STAFF_ROLES } from '../auth/auth.decorators';
import { AuditService } from '../core/audit.service';
import { PrismaService } from '../core/prisma.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { RequestPresenter, requestInclude } from '../emergency/request.presenter';
import { StatusService } from '../emergency/status.service';
import { SimrsService } from '../simrs/simrs.service';
import { facilityParamSchema, requireFacility, scopeFacility, visibleRequests } from './operator.scope';

const statusList = z
  .string()
  .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean))
  .pipe(z.array(z.nativeEnum(RequestStatus, { errorMap: () => ({ message: 'Status tidak valid.' }) })));

export const requestFilterSchema = paginationSchema.merge(facilityParamSchema).extend({
  q: z.string().trim().max(100).optional(),
  case_type: z.string().trim().max(30).optional(),
  status: statusList.optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});

const acceptSchema = z.object({ ambulance_id: uuidSchema });
const rejectSchema = z.object({ reason: z.string({ required_error: 'Alasan wajib diisi.' }).trim().min(3, 'Alasan minimal 3 karakter.').max(255) });
const medicalRecordSchema = z.object({
  medical_record_no: z.string({ required_error: 'No. RM wajib diisi.' }).trim().min(1, 'No. RM wajib diisi.').max(30, 'No. RM maksimal 30 karakter.'),
});

/** Data Kasus Masuk (docs/api_contract.md §5.3). */
@Roles(...STAFF_ROLES)
@Controller('operator/requests')
export class OperatorRequestsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenter: RequestPresenter,
    private readonly dispatch: DispatchService,
    private readonly status: StatusService,
    private readonly simrs: SimrsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query(new ZodPipe(requestFilterSchema)) q: z.infer<typeof requestFilterSchema>) {
    const facilityId = scopeFacility(user, q.facility_id);
    const and: Prisma.EmergencyRequestWhereInput[] = [visibleRequests(facilityId)];
    if (q.case_type) and.push({ caseType: { code: q.case_type } });
    if (q.status?.length) and.push({ status: { in: q.status } });
    if (q.from || q.to) and.push({ requestedAt: jakartaRange(q.from, q.to) });
    if (q.q) {
      and.push({
        OR: [
          { patient: { name: { contains: q.q, mode: 'insensitive' } } },
          { address: { contains: q.q, mode: 'insensitive' } },
          { code: { contains: q.q, mode: 'insensitive' } },
          { patient: { facilityRecord: { some: { medicalRecordNo: { contains: q.q }, ...(facilityId ? { facilityId } : {}) } } } },
        ],
      });
    }
    const where = { AND: and };
    const [items, total] = await Promise.all([
      this.prisma.emergencyRequest.findMany({
        where,
        include: requestInclude,
        // enum diurutkan sesuai deklarasi → MENUNGGU (Panggilan) selalu di atas
        orderBy: [{ status: 'asc' }, { requestedAt: 'desc' }],
        ...skipTake(q),
      }),
      this.prisma.emergencyRequest.count({ where }),
    ]);
    return paged(items.map((r) => this.presenter.forOperator(r, facilityId)), total, q.page, q.per_page);
  }

  @Get(':id')
  async detail(
    @CurrentUser() user: AuthUser,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Query(new ZodPipe(facilityParamSchema)) q: z.infer<typeof facilityParamSchema>,
  ) {
    const facilityId = scopeFacility(user, q.facility_id);
    const request = await this.findVisible(id, facilityId);
    await this.audit.log(user.id, 'request.view', 'emergency_request', id);
    // Penyedia yang hanya ditawari belum melihat identitas & foto (desain §10)
    if (facilityId && request.facilityId !== facilityId) {
      const item = this.presenter.forOperator(request, facilityId);
      return ok({
        ...item,
        patient: { ...item.patient, identity_number: null },
        description: request.description,
        photos: [],
        location: { lat: request.lat, lng: request.lng, address: request.address },
        reporter: null,
        provider: null,
        destination: null,
        ambulance: null,
        eta_seconds: null,
      });
    }
    return ok(this.presenter.forOperatorDetail(request, facilityId));
  }

  @Post(':id/accept')
  @HttpCode(200)
  @Roles('FACILITY_OPERATOR', 'FACILITY_ADMIN')
  async accept(@CurrentUser() user: AuthUser, @Param('id', new ZodPipe(uuidSchema)) id: string, @Body(new ZodPipe(acceptSchema)) body: z.infer<typeof acceptSchema>) {
    const facilityId = requireFacility(user);
    const request = await this.dispatch.accept(id, facilityId, body.ambulance_id, user.id);
    await this.audit.log(user.id, 'request.accept', 'emergency_request', id, { ambulance_id: body.ambulance_id });
    return ok(this.presenter.forOperator(request, facilityId));
  }

  @Post(':id/reject')
  @HttpCode(200)
  @Roles('FACILITY_OPERATOR', 'FACILITY_ADMIN')
  async reject(@CurrentUser() user: AuthUser, @Param('id', new ZodPipe(uuidSchema)) id: string, @Body(new ZodPipe(rejectSchema)) body: z.infer<typeof rejectSchema>) {
    const facilityId = requireFacility(user);
    await this.dispatch.reject(id, facilityId, body.reason, user.id);
    await this.audit.log(user.id, 'request.reject', 'emergency_request', id, { reason: body.reason });
    return success();
  }

  @Put(':id/medical-record')
  @Roles('FACILITY_OPERATOR', 'FACILITY_ADMIN')
  async setMedicalRecord(
    @CurrentUser() user: AuthUser,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(medicalRecordSchema)) body: z.infer<typeof medicalRecordSchema>,
  ) {
    const facilityId = requireFacility(user);
    const request = await this.findOwned(id, facilityId);
    const facility = await this.prisma.facility.findUniqueOrThrow({ where: { id: facilityId } });
    if (facility.medicalRecordFormat && !new RegExp(facility.medicalRecordFormat).test(body.medical_record_no)) {
      throw AppError.field('medical_record_no', 'Format No. RM tidak sesuai.');
    }
    await this.prisma.facilityPatientRecord.upsert({
      where: { facilityId_patientId: { facilityId, patientId: request.patientId } },
      create: { facilityId, patientId: request.patientId, medicalRecordNo: body.medical_record_no, source: 'MANUAL', simrsStatus: 'NOT_CONFIGURED', createdById: user.id },
      update: { medicalRecordNo: body.medical_record_no, source: 'MANUAL', simrsMessage: 'Diisi manual oleh operator.', createdById: user.id },
    });
    await this.audit.log(user.id, 'medical_record.set', 'emergency_request', id, { medical_record_no: body.medical_record_no });
    const updated = await this.status.load(id);
    await this.status.publish(updated);
    return ok(this.presenter.forOperator(updated, facilityId));
  }

  @Post(':id/medical-record/sync')
  @HttpCode(200)
  @Roles('FACILITY_OPERATOR', 'FACILITY_ADMIN')
  async syncMedicalRecord(@CurrentUser() user: AuthUser, @Param('id', new ZodPipe(uuidSchema)) id: string) {
    const facilityId = requireFacility(user);
    await this.findOwned(id, facilityId);
    await this.simrs.lookup(id, { force: true, final: true });
    return ok(this.presenter.forOperator(await this.status.load(id), facilityId));
  }

  private async findVisible(id: string, facilityId: string | null) {
    const request = await this.prisma.emergencyRequest.findFirst({ where: { AND: [{ id }, visibleRequests(facilityId)] }, include: requestInclude });
    if (!request) throw AppError.notFound('Kasus tidak ditemukan.');
    return request;
  }

  private async findOwned(id: string, facilityId: string) {
    const request = await this.prisma.emergencyRequest.findFirst({ where: { id, facilityId } });
    if (!request) throw AppError.notFound('Kasus tidak ditemukan atau belum diterima penyedia Anda.');
    return request;
  }
}
