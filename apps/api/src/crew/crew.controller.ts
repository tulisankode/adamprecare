import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RequestStatus } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../common/app-error';
import { ok, success } from '../common/response';
import { latSchema, lngSchema, uuidSchema } from '../common/validators';
import { ZodPipe } from '../common/zod.pipe';
import { AuthUser, CurrentUser, Roles } from '../auth/auth.decorators';
import { PrismaService } from '../core/prisma.service';
import { RequestPresenter, requestInclude } from '../emergency/request.presenter';
import { TRACKED_STATUSES } from '../emergency/status';
import { StatusService } from '../emergency/status.service';
import { TrackingService } from './tracking.service';

const dutySchema = z.object({ on_duty: z.boolean({ required_error: 'on_duty wajib diisi.' }) });

const CREW_TRANSITIONS = ['DALAM_PERJALANAN', 'TIBA', 'MENUJU_FASKES', 'SAMPAI_DI_FASKES', 'SELESAI'] as const;
const statusSchema = z
  .object({
    status: z.enum(CREW_TRANSITIONS, { errorMap: () => ({ message: 'Status tidak valid.' }) }),
    destination_facility_id: uuidSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.status === 'MENUJU_FASKES' && !v.destination_facility_id) {
      ctx.addIssue({ code: 'custom', path: ['destination_facility_id'], message: 'FASKES tujuan wajib dipilih.' });
    }
  });

const locationSchema = z.object({
  lat: latSchema,
  lng: lngSchema,
  heading: z.coerce.number().min(0).max(360).nullable().optional(),
  speed: z.coerce.number().min(0).max(100).nullable().optional(),
  recorded_at: z.string().datetime().optional(),
});

/** Mode petugas ambulans di aplikasi mobile (docs/api_contract.md §4). */
@Roles('CREW')
@Controller('crew')
export class CrewController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly status: StatusService,
    private readonly presenter: RequestPresenter,
    private readonly tracking: TrackingService,
  ) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return ok(await this.crewInfo(user.id));
  }

  @Patch('duty')
  async duty(@CurrentUser() user: AuthUser, @Body(new ZodPipe(dutySchema)) body: z.infer<typeof dutySchema>) {
    await this.crew(user.id);
    await this.prisma.ambulanceCrew.update({ where: { userId: user.id }, data: { onDuty: body.on_duty } });
    return ok(await this.crewInfo(user.id));
  }

  @Get('assignments/active')
  async active(@CurrentUser() user: AuthUser) {
    const crew = await this.crew(user.id);
    const request = await this.prisma.emergencyRequest.findFirst({
      where: { ambulanceId: crew.ambulanceId, status: { in: TRACKED_STATUSES } },
      include: requestInclude,
      orderBy: { requestedAt: 'desc' },
    });
    return ok(request ? this.presenter.forMobile(request, true) : null);
  }

  @Post('assignments/:id/status')
  @HttpCode(200)
  async updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(statusSchema)) body: z.infer<typeof statusSchema>,
  ) {
    const crew = await this.crew(user.id);
    const request = await this.prisma.emergencyRequest.findFirst({ where: { id, ambulanceId: crew.ambulanceId } });
    if (!request) throw AppError.notFound('Tugas tidak ditemukan.');
    if (body.destination_facility_id) {
      const dest = await this.prisma.facility.findFirst({
        where: { id: body.destination_facility_id, isActive: true, type: { not: 'PSC_119' } },
      });
      if (!dest) throw AppError.field('destination_facility_id', 'FASKES tujuan tidak ditemukan.');
    }
    const updated = await this.status.transition(id, body.status as RequestStatus, {
      actorUserId: user.id,
      data: body.status === 'MENUJU_FASKES' ? { destinationFacilityId: body.destination_facility_id, etaSeconds: null } : undefined,
    });
    return ok(this.presenter.forMobile(updated, true));
  }

  @Post('location')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async location(@CurrentUser() user: AuthUser, @Body(new ZodPipe(locationSchema)) body: z.infer<typeof locationSchema>) {
    const crew = await this.crew(user.id);
    await this.tracking.record(crew.ambulanceId, {
      lat: body.lat,
      lng: body.lng,
      heading: body.heading ?? null,
      speed: body.speed ?? null,
      recordedAt: body.recorded_at ? new Date(body.recorded_at) : new Date(),
    });
    return success();
  }

  private async crew(userId: string) {
    const crew = await this.prisma.ambulanceCrew.findUnique({ where: { userId } });
    if (!crew) throw AppError.forbidden('Akun petugas belum ditautkan ke ambulans.');
    return crew;
  }

  private async crewInfo(userId: string) {
    const crew = await this.prisma.ambulanceCrew.findUnique({
      where: { userId },
      include: { ambulance: { include: { facility: { select: { id: true, name: true } } } } },
    });
    if (!crew) throw AppError.forbidden('Akun petugas belum ditautkan ke ambulans.');
    const a = crew.ambulance;
    return {
      on_duty: crew.onDuty,
      ambulance: { id: a.id, name: a.name, plate_number: a.plateNumber, type: a.type, status: a.status },
      facility: { id: a.facility.id, name: a.facility.name },
    };
  }
}
