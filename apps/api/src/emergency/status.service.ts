import { Injectable } from '@nestjs/common';
import { Prisma, RequestStatus } from '@prisma/client';
import { AppError } from '../common/app-error';
import { PrismaService } from '../core/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { FullRequest, RequestPresenter, requestInclude } from './request.presenter';
import { FINAL_STATUSES, STATUS_TIMESTAMP, statusLabel, TRANSITIONS } from './status';

export interface TransitionOptions {
  actorUserId: string | null;
  note?: string;
  /** Data tambahan yang ikut disimpan pada transisi (mis. destinationFacilityId). */
  data?: Prisma.EmergencyRequestUncheckedUpdateInput;
}

/** Satu-satunya jalur perubahan status permintaan: validasi transisi, log, efek samping, dan event realtime. */
@Injectable()
export class StatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenter: RequestPresenter,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Jalankan transisi di dalam transaksi yang sudah ada (baris permintaan dikunci). */
  async transitionTx(tx: Prisma.TransactionClient, requestId: string, to: RequestStatus, opts: TransitionOptions) {
    const rows = await tx.$queryRaw<{ status: RequestStatus; ambulance_id: string | null }[]>`
      SELECT status, ambulance_id FROM emergency_requests WHERE id = ${requestId}::uuid FOR UPDATE`;
    const current = rows[0];
    if (!current) throw AppError.notFound('Permintaan tidak ditemukan.');
    if (!TRANSITIONS[current.status].includes(to)) {
      throw AppError.conflict('INVALID_STATUS_TRANSITION', `Status tidak dapat diubah dari ${current.status} ke ${to}.`);
    }
    const timestampField = STATUS_TIMESTAMP[to];
    await tx.emergencyRequest.update({
      where: { id: requestId },
      data: { ...opts.data, status: to, ...(timestampField ? { [timestampField]: new Date() } : {}) },
    });
    await tx.emergencyStatusLog.create({
      data: { requestId, fromStatus: current.status, toStatus: to, actorUserId: opts.actorUserId, note: opts.note },
    });
    if (FINAL_STATUSES.includes(to) && current.ambulance_id) {
      await tx.ambulance.update({ where: { id: current.ambulance_id }, data: { status: 'TERSEDIA' } });
    }
    if (to === 'DIBATALKAN' || to === 'TIDAK_TERLAYANI') {
      await tx.dispatchOffer.updateMany({ where: { requestId, status: 'OFFERED' }, data: { status: 'WITHDRAWN', respondedAt: new Date() } });
    }
    return current.status;
  }

  async transition(requestId: string, to: RequestStatus, opts: TransitionOptions): Promise<FullRequest> {
    let offeredFacilities: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      if (to === 'DIBATALKAN' || to === 'TIDAK_TERLAYANI') {
        const offers = await tx.dispatchOffer.findMany({ where: { requestId, status: 'OFFERED' }, select: { facilityId: true } });
        offeredFacilities = offers.map((o) => o.facilityId);
      }
      await this.transitionTx(tx, requestId, to, opts);
    });
    const request = await this.load(requestId);
    for (const facilityId of offeredFacilities) {
      this.realtime.toFacility(facilityId, 'offer.withdrawn', { request_id: requestId, reason: to });
    }
    await this.publish(request, { notifyReporter: opts.actorUserId !== request.reporterUserId });
    return request;
  }

  load(requestId: string): Promise<FullRequest> {
    return this.prisma.emergencyRequest.findUniqueOrThrow({ where: { id: requestId }, include: requestInclude });
  }

  /** Kirim `request.updated` ke pelapor, penyedia (penerima & yang ditawari), dan petugas ambulans. */
  async publish(request: FullRequest, opts: { notifyReporter?: boolean } = {}) {
    this.realtime.toUser(request.reporterUserId, 'request.updated', this.presenter.forMobile(request));
    const facilities = new Set<string>(request.offers.filter((o) => o.status === 'OFFERED').map((o) => o.facilityId));
    if (request.facilityId) facilities.add(request.facilityId);
    for (const facilityId of facilities) {
      this.realtime.toFacility(facilityId, 'request.updated', this.presenter.forOperator(request, facilityId));
    }
    this.realtime.toAdmins('request.updated', this.presenter.forOperator(request, null));
    if (request.ambulanceId) {
      const crew = await this.prisma.ambulanceCrew.findMany({ where: { ambulanceId: request.ambulanceId }, select: { userId: true } });
      for (const c of crew) this.realtime.toUser(c.userId, 'request.updated', this.presenter.forMobile(request, true));
    }
    if (opts.notifyReporter) {
      await this.notifications.push(
        request.reporterUserId,
        'Status permintaan ambulans',
        statusLabel(request.status, request.facility?.name, request.destination?.name),
        { request_id: request.id, status: request.status },
      );
    }
  }
}
