import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Patient } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../common/app-error';
import { ageText } from '../common/format';
import { ok, paged, Pagination, paginationSchema, skipTake, success } from '../common/response';
import { dateOnlySchema, genderSchema, identitySchema, uuidSchema } from '../common/validators';
import { ZodPipe } from '../common/zod.pipe';
import { AuthUser, CurrentUser, Roles } from '../auth/auth.decorators';
import { presentCaseType } from '../content/case-type.presenter';
import { CryptoService } from '../core/crypto.service';
import { PrismaService } from '../core/prisma.service';
import { ACTIVE_STATUSES } from '../emergency/status';
import { StorageService } from '../storage/storage.service';

const patientFields = {
  name: z.string().trim().min(1, 'Nama pasien wajib diisi.').max(100),
  identity_number: identitySchema.nullable().optional(),
  age_years: z.coerce.number().int().min(0, 'Umur tidak valid.').max(130, 'Umur tidak valid.').nullable().optional(),
  birth_date: dateOnlySchema.nullable().optional(),
  gender: genderSchema.nullable().optional(),
};
const createSchema = z.object(patientFields);
const updateSchema = z.object(patientFields).partial();

@Roles('USER')
@Controller('patients')
export class PatientsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser, @Query(new ZodPipe(paginationSchema)) q: Pagination) {
    const where = { ownerUserId: user.id, deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.patient.findMany({ where, orderBy: { updatedAt: 'desc' }, ...skipTake(q) }),
      this.prisma.patient.count({ where }),
    ]);
    return paged(items.map((p) => this.present(p)), total, q.page, q.per_page);
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createSchema)) body: z.infer<typeof createSchema>) {
    const patient = await this.prisma.patient.create({ data: { ownerUserId: user.id, ...this.toData(body) } });
    return ok(this.present(patient));
  }

  @Get(':id')
  async detail(@CurrentUser() user: AuthUser, @Param('id', new ZodPipe(uuidSchema)) id: string) {
    const patient = await this.find(user.id, id);
    const last = await this.prisma.emergencyRequest.findFirst({
      where: { patientId: id },
      orderBy: { requestedAt: 'desc' },
      include: { caseType: true, photos: { orderBy: { createdAt: 'asc' } } },
    });
    return ok({
      ...this.present(patient),
      last_case: last
        ? {
            request_id: last.id,
            case_type: presentCaseType(last.caseType),
            description: last.description,
            address: last.address,
            photos: last.photos.map((ph) => ({ id: ph.id, url: this.storage.signedUrl(ph.objectKey) })),
            requested_at: last.requestedAt,
          }
        : null,
    });
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(updateSchema)) body: z.infer<typeof updateSchema>,
  ) {
    await this.find(user.id, id);
    const patient = await this.prisma.patient.update({ where: { id }, data: this.toData(body) });
    return ok(this.present(patient));
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', new ZodPipe(uuidSchema)) id: string) {
    await this.find(user.id, id);
    const active = await this.prisma.emergencyRequest.count({ where: { patientId: id, status: { in: ACTIVE_STATUSES } } });
    if (active) throw AppError.conflict('INVALID_STATUS_TRANSITION', 'Pasien masih memiliki permintaan ambulans yang aktif.');
    await this.prisma.patient.update({ where: { id }, data: { deletedAt: new Date() } });
    return success();
  }

  private async find(ownerUserId: string, id: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id, ownerUserId, deletedAt: null } });
    if (!patient) throw AppError.notFound('Pasien tidak ditemukan.');
    return patient;
  }

  private toData(body: z.infer<typeof updateSchema>) {
    return {
      ...(body.name !== undefined ? { name: body.name, nameUnknown: false } : {}),
      ...(body.identity_number === undefined
        ? {}
        : body.identity_number === null
          ? { identityEncrypted: null, identityHash: null }
          : {
              identityEncrypted: this.crypto.encrypt(body.identity_number),
              identityHash: this.crypto.blindIndex(body.identity_number),
              identityUnknown: false,
            }),
      ageYears: body.age_years,
      birthDate: body.birth_date === undefined ? undefined : body.birth_date ? new Date(`${body.birth_date}T00:00:00Z`) : null,
      gender: body.gender,
    };
  }

  private present(p: Patient) {
    return {
      id: p.id,
      is_self: p.isSelf,
      name: p.name,
      name_unknown: p.nameUnknown,
      identity_number: this.crypto.decrypt(p.identityEncrypted),
      identity_unknown: p.identityUnknown,
      age_years: p.ageYears,
      birth_date: p.birthDate ? p.birthDate.toISOString().slice(0, 10) : null,
      age_text: ageText(p.birthDate, p.ageYears),
      gender: p.gender,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    };
  }
}
