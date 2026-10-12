import { Injectable, Logger } from '@nestjs/common';
import { DispatchStrategy, Prisma } from '@prisma/client';
import { AppError } from '../common/app-error';
import { AppConfig } from '../config/app-config.service';
import { PrismaService } from '../core/prisma.service';
import { RedisService } from '../core/redis.service';
import { RequestPresenter } from '../emergency/request.presenter';
import { StatusService } from '../emergency/status.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { SimrsQueue } from '../simrs/simrs.queue';
import { DispatchQueue } from './dispatch.queue';

const RADII_KM = [10, 20, 40];
/** Pada strategi BERURUTAN: jumlah FASKES mitra yang dicoba sebelum PSC 119 (desain §9.2). */
const SEQUENTIAL_FASKES_BEFORE_PSC = 3;

interface RequestPoint {
  id: string;
  lat: number;
  lng: number;
}

/**
 * Dispatch ambulans (desain §9): menentukan kandidat FASKES mitra & PSC 119, membuat penawaran,
 * menangani terima/tolak/timeout, eskalasi ke admin, dan status TIDAK_TERLAYANI.
 */
@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly queue: DispatchQueue,
    private readonly status: StatusService,
    private readonly presenter: RequestPresenter,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
    private readonly simrs: SimrsQueue,
    private readonly redis: RedisService,
  ) {}

  /** Tawarkan ke penyedia berikutnya bila tidak ada penawaran yang masih aktif. */
  async advance(requestId: string): Promise<void> {
    const lockKey = `dispatch:lock:${requestId}`;
    if ((await this.redis.client.set(lockKey, '1', 'EX', 15, 'NX')) !== 'OK') {
      await this.queue.advance(requestId, 1000); // proses lain sedang berjalan → ulangi sebentar lagi
      return;
    }
    try {
      await this.advanceLocked(requestId);
    } finally {
      await this.redis.client.del(lockKey);
    }
  }

  private async advanceLocked(requestId: string): Promise<void> {
    const request = await this.prisma.emergencyRequest.findUnique({
      where: { id: requestId },
      include: { caseType: true, offers: { include: { facility: { select: { type: true } } } } },
    });
    if (!request || request.status !== 'MENUNGGU') return;
    if (request.offers.some((o) => o.status === 'OFFERED')) return;

    const offered = request.offers.map((o) => o.facilityId);
    const faskesTried = request.offers.filter((o) => o.facility.type !== 'PSC_119').length;
    const pscOffered = request.offers.some((o) => o.facility.type === 'PSC_119');
    const batch = await this.nextBatch(request, request.caseType.dispatchStrategy, offered, faskesTried, pscOffered);

    if (!batch.length) {
      this.logger.warn(`Tidak ada kandidat penyedia untuk ${request.code}`);
      await this.escalate(requestId, 'Tidak ada penyedia yang tersedia');
      return;
    }
    const round = request.dispatchRound + 1;
    await this.prisma.emergencyRequest.update({ where: { id: requestId }, data: { dispatchRound: round } });
    for (const facilityId of batch) await this.offer(requestId, facilityId, round);
  }

  private async nextBatch(
    point: RequestPoint,
    strategy: DispatchStrategy,
    offered: string[],
    faskesTried: number,
    pscOffered: boolean,
  ): Promise<string[]> {
    const psc = pscOffered ? null : await this.pscFor(point);
    if (strategy === 'BERURUTAN') {
      if (faskesTried >= SEQUENTIAL_FASKES_BEFORE_PSC && psc) return [psc];
      const faskes = await this.nearestFaskes(point, offered);
      if (faskes) return [faskes];
      return psc ? [psc] : [];
    }
    // PARALEL & PSC_DULU: PSC 119 wilayah + FASKES mitra terdekat sekaligus; penerima pertama menang
    const faskes = await this.nearestFaskes(point, offered);
    return [psc, faskes].filter((id): id is string => Boolean(id));
  }

  private async nearestFaskes(point: RequestPoint, exclude: string[]): Promise<string | null> {
    const requireCrew = this.config.get('DISPATCH_REQUIRE_CREW_ON_DUTY');
    const excluded = exclude.length ? Prisma.sql`AND f.id NOT IN (${Prisma.join(exclude.map((id) => Prisma.sql`${id}::uuid`))})` : Prisma.empty;
    const crewCondition = requireCrew
      ? Prisma.sql`AND EXISTS (SELECT 1 FROM ambulance_crews c WHERE c.ambulance_id = a.id AND c.on_duty)`
      : Prisma.empty;
    const here = Prisma.sql`ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography`;
    for (const km of RADII_KM) {
      const rows = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT f.id FROM facilities f
        WHERE f.is_active AND f.accepts_emergency AND f.type <> 'PSC_119' AND f.integration_mode = 'DASHBOARD'
          ${excluded}
          AND ST_DWithin(ST_SetSRID(ST_MakePoint(f.lng, f.lat), 4326)::geography, ${here}, ${km * 1000})
          AND EXISTS (SELECT 1 FROM ambulances a WHERE a.facility_id = f.id AND a.status = 'TERSEDIA' ${crewCondition})
        ORDER BY ST_Distance(ST_SetSRID(ST_MakePoint(f.lng, f.lat), 4326)::geography, ${here})
        LIMIT 1`;
      if (rows[0]) return rows[0].id;
    }
    return null;
  }

  private async pscFor(point: RequestPoint): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT f.id FROM facilities f
      WHERE f.type = 'PSC_119' AND f.is_active AND f.accepts_emergency AND f.integration_mode = 'DASHBOARD'
        AND f.service_area IS NOT NULL
        AND ST_Covers(f.service_area, ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography)
      LIMIT 1`;
    return rows[0]?.id ?? null;
  }

  private async offer(requestId: string, facilityId: string, round: number) {
    const timeoutMs = this.config.get('DISPATCH_OFFER_TIMEOUT_SECONDS') * 1000;
    const offer = await this.prisma.dispatchOffer.create({
      data: { requestId, facilityId, round, expiresAt: new Date(Date.now() + timeoutMs) },
    });
    await this.queue.offerTimeout(offer.id, timeoutMs);
    const request = await this.status.load(requestId);
    this.realtime.toFacility(facilityId, 'offer.created', this.presenter.forOperator(request, facilityId));
    await this.notifications.notifyFacility(facilityId, {
      type: 'offer.created',
      title: `Panggilan darurat: ${request.caseType.name}`,
      body: `${request.code} — ${request.address}`,
      requestId,
    });
  }

  async offerTimeout(offerId: string) {
    const expired = await this.prisma.dispatchOffer.updateMany({
      where: { id: offerId, status: 'OFFERED' },
      data: { status: 'EXPIRED', respondedAt: new Date() },
    });
    if (!expired.count) return;
    const offer = await this.prisma.dispatchOffer.findUniqueOrThrow({ where: { id: offerId } });
    this.realtime.toFacility(offer.facilityId, 'offer.withdrawn', { request_id: offer.requestId, reason: 'EXPIRED' });
    await this.advance(offer.requestId);
  }

  async accept(requestId: string, facilityId: string, ambulanceId: string, actorUserId: string) {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ status: string }[]>`SELECT status FROM emergency_requests WHERE id = ${requestId}::uuid FOR UPDATE`;
      if (!rows[0]) throw AppError.notFound('Permintaan tidak ditemukan.');
      const offer = await tx.dispatchOffer.findUnique({ where: { requestId_facilityId: { requestId, facilityId } } });
      if (!offer) throw AppError.forbidden('Permintaan ini tidak ditawarkan ke penyedia Anda.');
      if (rows[0].status !== 'MENUNGGU') throw AppError.conflict('ALREADY_TAKEN', 'Kasus sudah ditangani penyedia lain atau dibatalkan.');
      if (offer.status !== 'OFFERED') throw AppError.conflict('ALREADY_TAKEN', 'Waktu penawaran untuk kasus ini sudah habis.');

      const ambulances = await tx.$queryRaw<{ id: string; status: string; facility_id: string }[]>`
        SELECT id, status, facility_id FROM ambulances WHERE id = ${ambulanceId}::uuid FOR UPDATE`;
      const ambulance = ambulances[0];
      if (!ambulance || ambulance.facility_id !== facilityId) throw AppError.field('ambulance_id', 'Ambulans tidak ditemukan.');
      if (ambulance.status !== 'TERSEDIA') throw AppError.field('ambulance_id', 'Ambulans sedang bertugas atau nonaktif.');

      const facility = await tx.facility.findUniqueOrThrow({ where: { id: facilityId }, select: { type: true } });
      await this.status.transitionTx(tx, requestId, 'DITERIMA', {
        actorUserId,
        data: {
          facilityId,
          ambulanceId,
          destinationFacilityId: facility.type === 'PSC_119' ? null : facilityId,
          providerType: facility.type === 'PSC_119' ? 'PSC_119' : 'FASKES_MITRA',
        },
      });
      await tx.ambulance.update({ where: { id: ambulanceId }, data: { status: 'BERTUGAS' } });
      await tx.dispatchOffer.update({ where: { id: offer.id }, data: { status: 'ACCEPTED', respondedAt: new Date(), respondedById: actorUserId } });
      await tx.dispatchOffer.updateMany({
        where: { requestId, status: 'OFFERED', NOT: { id: offer.id } },
        data: { status: 'WITHDRAWN', respondedAt: new Date() },
      });
    });

    const others = await this.prisma.dispatchOffer.findMany({ where: { requestId, status: 'WITHDRAWN' }, select: { facilityId: true } });
    for (const o of others) this.realtime.toFacility(o.facilityId, 'offer.withdrawn', { request_id: requestId, reason: 'ALREADY_TAKEN' });

    const request = await this.status.load(requestId);
    await this.status.publish(request, { notifyReporter: true });
    const crew = await this.prisma.ambulanceCrew.findMany({ where: { ambulanceId }, select: { userId: true } });
    for (const c of crew) {
      this.realtime.toUser(c.userId, 'assignment.created', this.presenter.forMobile(request, true));
      await this.notifications.push(c.userId, 'Tugas baru', `${request.caseType.name} — ${request.address}`, { request_id: requestId });
    }
    await this.simrs.lookup(requestId);
    return request;
  }

  async reject(requestId: string, facilityId: string, reason: string, actorUserId: string) {
    const updated = await this.prisma.dispatchOffer.updateMany({
      where: { requestId, facilityId, status: 'OFFERED' },
      data: { status: 'REJECTED', respondedAt: new Date(), respondedById: actorUserId, rejectReason: reason },
    });
    if (!updated.count) throw AppError.conflict('ALREADY_TAKEN', 'Penawaran sudah tidak aktif.');
    await this.queue.advance(requestId);
  }

  /** Belum ada penerima setelah batas waktu / kandidat habis → beri tahu super admin. */
  async escalate(requestId: string, reason = 'Belum ada penyedia yang menerima') {
    const updated = await this.prisma.emergencyRequest.updateMany({
      where: { id: requestId, status: 'MENUNGGU', escalatedAt: null },
      data: { escalatedAt: new Date() },
    });
    if (!updated.count) return;
    const request = await this.status.load(requestId);
    this.realtime.toAdmins('request.escalated', this.presenter.forOperator(request, null));
    await this.notifications.notifyAdmins({
      type: 'request.escalated',
      title: `Eskalasi: ${request.code}`,
      body: `${reason}. ${request.caseType.name} — ${request.address}`,
      requestId,
    });
  }

  async markUnserved(requestId: string) {
    const request = await this.prisma.emergencyRequest.findUnique({ where: { id: requestId }, select: { status: true } });
    if (request?.status !== 'MENUNGGU') return;
    await this.status.transition(requestId, 'TIDAK_TERLAYANI', { actorUserId: null, note: 'Batas waktu dispatch terlampaui' });
  }
}
