import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { AmbulanceStatus, AmbulanceType, Prisma, RequestStatus } from '@prisma/client';
import ExcelJS from 'exceljs';
import { Response } from 'express';
import { z } from 'zod';
import { AppError } from '../common/app-error';
import { ageText, genderLabel, jakartaRange } from '../common/format';
import { ok, paged, paginationSchema, skipTake, success } from '../common/response';
import { dateOnlySchema, uuidSchema } from '../common/validators';
import { ZodPipe } from '../common/zod.pipe';
import { AuthUser, CurrentUser, Roles, STAFF_ROLES } from '../auth/auth.decorators';
import { presentCaseType } from '../content/case-type.presenter';
import { AuditService } from '../core/audit.service';
import { CryptoService } from '../core/crypto.service';
import { PrismaService } from '../core/prisma.service';
import { STATUS_BADGE } from '../emergency/status';
import { facilityParamSchema, requireFacility, scopeFacility } from './operator.scope';

const statusList = z
  .string()
  .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean))
  .pipe(z.array(z.nativeEnum(RequestStatus, { errorMap: () => ({ message: 'Status tidak valid.' }) })));

const tripFilterSchema = paginationSchema.merge(facilityParamSchema).extend({
  q: z.string().trim().max(100).optional(),
  status: statusList.optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});

const reportFilterSchema = paginationSchema.merge(facilityParamSchema).extend({
  patient_name: z.string().trim().max(100).optional(),
  case_type: z.string().trim().max(30).optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});
const exportSchema = reportFilterSchema.omit({ page: true, per_page: true }).extend({ format: z.enum(['xlsx']).default('xlsx') });

const ambulanceListSchema = facilityParamSchema.extend({
  status: z.nativeEnum(AmbulanceStatus).optional(),
  type: z.nativeEnum(AmbulanceType).optional(),
});
const ambulanceCreateSchema = z.object({
  name: z.string().trim().min(1, 'Nama ambulans wajib diisi.').max(100),
  plate_number: z.string().trim().min(3, 'No. Plat wajib diisi.').max(20).transform((v) => v.toUpperCase()),
  type: z.nativeEnum(AmbulanceType),
  photo_url: z.string().url().nullable().optional(),
});
const ambulanceUpdateSchema = ambulanceCreateSchema.partial().extend({ status: z.nativeEnum(AmbulanceStatus).optional() });

const notificationListSchema = paginationSchema.extend({ unread: z.enum(['true', 'false']).optional() });
const notificationReadSchema = z.object({ ids: z.array(uuidSchema).max(200).optional() });

/** Tracking Ambulans, Laporan, Ambulans, dan Notifikasi staf (docs/api_contract.md §5.4–5.7). */
@Roles(...STAFF_ROLES)
@Controller('operator')
export class OperatorTrackingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
  ) {}

  // ---------- Tracking ----------

  @Get('trips')
  async trips(@CurrentUser() user: AuthUser, @Query(new ZodPipe(tripFilterSchema)) q: z.infer<typeof tripFilterSchema>) {
    const facilityId = scopeFacility(user, q.facility_id);
    const and: Prisma.EmergencyRequestWhereInput[] = [{ ambulanceId: { not: null } }];
    if (facilityId) and.push({ facilityId });
    if (q.status?.length) and.push({ status: { in: q.status } });
    if (q.from || q.to) and.push({ requestedAt: jakartaRange(q.from, q.to) });
    if (q.q) {
      and.push({
        ambulance: { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { plateNumber: { contains: q.q, mode: 'insensitive' } }] },
      });
    }
    const where = { AND: and };
    const [items, total] = await Promise.all([
      this.prisma.emergencyRequest.findMany({ where, include: { ambulance: true, patient: true }, orderBy: { requestedAt: 'desc' }, ...skipTake(q) }),
      this.prisma.emergencyRequest.count({ where }),
    ]);
    return paged(items.map((r) => this.presentTrip(r)), total, q.page, q.per_page);
  }

  @Get('trips/:id')
  async trip(@CurrentUser() user: AuthUser, @Param('id', new ZodPipe(uuidSchema)) id: string, @Query(new ZodPipe(facilityParamSchema)) q: z.infer<typeof facilityParamSchema>) {
    const facilityId = scopeFacility(user, q.facility_id);
    const request = await this.prisma.emergencyRequest.findFirst({
      where: { id, ambulanceId: { not: null }, ...(facilityId ? { facilityId } : {}) },
      include: { ambulance: true, patient: true, locations: { orderBy: { recordedAt: 'asc' }, take: 2000 } },
    });
    if (!request) throw AppError.notFound('Perjalanan tidak ditemukan.');
    return ok({
      ...this.presentTrip(request),
      route: request.locations.map((l) => ({ lat: l.lat, lng: l.lng, at: l.recordedAt })),
    });
  }

  private presentTrip(r: Prisma.EmergencyRequestGetPayload<{ include: { ambulance: true; patient: true } }>) {
    const a = r.ambulance;
    return {
      request_id: r.id,
      code: r.code,
      patient_name: r.patient.name,
      called_at: r.requestedAt,
      ambulance: a ? { id: a.id, name: a.name, plate_number: a.plateNumber } : null,
      status: r.status,
      status_badge: STATUS_BADGE[r.status],
      incident_location: { lat: r.lat, lng: r.lng },
      ambulance_location:
        a && a.lastLat !== null && a.lastLng !== null
          ? { lat: a.lastLat, lng: a.lastLng, heading: a.lastHeading, updated_at: a.lastLocationAt }
          : null,
    };
  }

  // ---------- Laporan ----------

  @Get('reports')
  async reports(@CurrentUser() user: AuthUser, @Query(new ZodPipe(reportFilterSchema)) q: z.infer<typeof reportFilterSchema>) {
    const where = this.reportWhere(user, q);
    const { skip, take } = skipTake(q);
    const [items, total] = await Promise.all([
      this.prisma.emergencyRequest.findMany({ where, include: { ambulance: true, patient: true, caseType: true }, orderBy: { requestedAt: 'desc' }, skip, take }),
      this.prisma.emergencyRequest.count({ where }),
    ]);
    return paged(
      items.map((r, i) => ({
        request_id: r.id,
        no: skip + i + 1,
        called_at: r.requestedAt,
        ambulance: r.ambulance ? { name: r.ambulance.name, plate_number: r.ambulance.plateNumber } : null,
        destination_address: r.address,
        patient: {
          identity_number: this.crypto.decrypt(r.patient.identityEncrypted),
          name: r.patient.name,
          gender: r.patient.gender,
          age_text: ageText(r.patient.birthDate, r.patient.ageYears),
        },
        case_type: presentCaseType(r.caseType),
      })),
      total,
      q.page,
      q.per_page,
    );
  }

  @Get('reports/export')
  async exportReports(@CurrentUser() user: AuthUser, @Query(new ZodPipe(exportSchema)) q: z.infer<typeof exportSchema>, @Res() res: Response) {
    const items = await this.prisma.emergencyRequest.findMany({
      where: this.reportWhere(user, q),
      include: { ambulance: true, patient: true, caseType: true, facility: { select: { name: true } } },
      orderBy: { requestedAt: 'desc' },
      take: 10000,
    });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Laporan');
    ws.columns = [
      { header: 'No.', key: 'no', width: 6 },
      { header: 'Kode', key: 'code', width: 20 },
      { header: 'Waktu Panggil (WIB)', key: 'called', width: 20 },
      { header: 'Penyedia', key: 'provider', width: 24 },
      { header: 'Ambulans', key: 'ambulance', width: 18 },
      { header: 'No. Plat', key: 'plate', width: 14 },
      { header: 'Tujuan', key: 'address', width: 50 },
      { header: 'No. Identitas', key: 'identity', width: 20 },
      { header: 'Nama Pasien', key: 'patient', width: 24 },
      { header: 'Jenis Kelamin', key: 'gender', width: 14 },
      { header: 'Umur', key: 'age', width: 16 },
      { header: 'Jenis Kasus', key: 'case', width: 18 },
      { header: 'Status', key: 'status', width: 18 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE95B58' } };
    items.forEach((r, i) =>
      ws.addRow({
        no: i + 1,
        code: r.code,
        called: new Date(r.requestedAt.getTime() + 7 * 3600000).toISOString().replace('T', ' ').slice(0, 16),
        provider: r.facility?.name ?? '-',
        ambulance: r.ambulance?.name ?? '-',
        plate: r.ambulance?.plateNumber ?? '-',
        address: r.address,
        identity: this.crypto.decrypt(r.patient.identityEncrypted) ?? '-',
        patient: r.patient.name ?? 'Tidak diketahui',
        gender: genderLabel(r.patient.gender),
        age: ageText(r.patient.birthDate, r.patient.ageYears),
        case: r.caseTypeOther ? `${r.caseType.name} (${r.caseTypeOther})` : r.caseType.name,
        status: STATUS_BADGE[r.status],
      }),
    );
    await this.audit.log(user.id, 'report.export', 'emergency_request', null, { count: items.length });
    const filename = `laporan-adam-precare-${q.from ?? 'awal'}-${q.to ?? 'akhir'}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.send(Buffer.from(await wb.xlsx.writeBuffer()));
  }

  private reportWhere(user: AuthUser, q: Omit<z.infer<typeof exportSchema>, 'format'>): Prisma.EmergencyRequestWhereInput {
    const facilityId = scopeFacility(user, q.facility_id);
    const and: Prisma.EmergencyRequestWhereInput[] = [{ ambulanceId: { not: null } }];
    if (facilityId) and.push({ facilityId });
    if (q.case_type) and.push({ caseType: { code: q.case_type } });
    if (q.patient_name) and.push({ patient: { name: { contains: q.patient_name, mode: 'insensitive' } } });
    if (q.from || q.to) and.push({ requestedAt: jakartaRange(q.from, q.to) });
    return { AND: and };
  }

  // ---------- Ambulans ----------

  @Get('ambulances')
  async ambulances(@CurrentUser() user: AuthUser, @Query(new ZodPipe(ambulanceListSchema)) q: z.infer<typeof ambulanceListSchema>) {
    const facilityId = requireFacility(user, q.facility_id);
    const items = await this.prisma.ambulance.findMany({
      where: { facilityId, status: q.status, type: q.type },
      include: { crew: { include: { user: { select: { id: true, name: true } } } } },
      orderBy: { name: 'asc' },
    });
    return ok(items.map((a) => this.presentAmbulance(a)));
  }

  @Post('ambulances')
  @Roles('FACILITY_ADMIN')
  async createAmbulance(@CurrentUser() user: AuthUser, @Body(new ZodPipe(ambulanceCreateSchema)) body: z.infer<typeof ambulanceCreateSchema>) {
    const facilityId = requireFacility(user);
    const a = await this.prisma.ambulance.create({
      data: { facilityId, name: body.name, plateNumber: body.plate_number, type: body.type, photoUrl: body.photo_url ?? null },
      include: { crew: { include: { user: { select: { id: true, name: true } } } } },
    });
    return ok(this.presentAmbulance(a));
  }

  @Patch('ambulances/:id')
  @Roles('FACILITY_ADMIN')
  async updateAmbulance(
    @CurrentUser() user: AuthUser,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(ambulanceUpdateSchema)) body: z.infer<typeof ambulanceUpdateSchema>,
  ) {
    const facilityId = requireFacility(user);
    const existing = await this.prisma.ambulance.findFirst({ where: { id, facilityId } });
    if (!existing) throw AppError.notFound('Ambulans tidak ditemukan.');
    if (body.status && existing.status === 'BERTUGAS') throw AppError.field('status', 'Ambulans sedang bertugas.');
    const a = await this.prisma.ambulance.update({
      where: { id },
      data: { name: body.name, plateNumber: body.plate_number, type: body.type, photoUrl: body.photo_url, status: body.status },
      include: { crew: { include: { user: { select: { id: true, name: true } } } } },
    });
    return ok(this.presentAmbulance(a));
  }

  private presentAmbulance(a: Prisma.AmbulanceGetPayload<{ include: { crew: { include: { user: { select: { id: true; name: true } } } } } }>) {
    return {
      id: a.id,
      name: a.name,
      plate_number: a.plateNumber,
      type: a.type,
      status: a.status,
      photo_url: a.photoUrl,
      crew: a.crew.map((c) => ({ id: c.user.id, name: c.user.name, on_duty: c.onDuty })),
    };
  }

  // ---------- Notifikasi ----------

  @Get('notifications')
  async notifications(@CurrentUser() user: AuthUser, @Query(new ZodPipe(notificationListSchema)) q: z.infer<typeof notificationListSchema>) {
    const where: Prisma.NotificationWhereInput = { userId: user.id, ...(q.unread === 'true' ? { readAt: null } : {}) };
    const [items, total, unread] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, ...skipTake(q) }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);
    return paged(
      items.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, request_id: n.requestId, read_at: n.readAt, created_at: n.createdAt })),
      total,
      q.page,
      q.per_page,
      { unread_count: unread },
    );
  }

  @Post('notifications/read')
  @HttpCode(200)
  async readNotifications(@CurrentUser() user: AuthUser, @Body(new ZodPipe(notificationReadSchema)) body: z.infer<typeof notificationReadSchema>) {
    await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null, ...(body.ids?.length ? { id: { in: body.ids } } : {}) },
      data: { readAt: new Date() },
    });
    return success();
  }
}
