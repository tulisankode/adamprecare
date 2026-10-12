import { Injectable } from '@nestjs/common';
import { PrismaService } from '../core/prisma.service';
import { TRACKED_STATUSES } from '../emergency/status';
import { GeoService } from '../geo/geo.service';
import { RealtimeService } from '../realtime/realtime.service';

interface LocationInput {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  recordedAt: Date;
}

/** Lokasi ambulans: simpan posisi terakhir & jejak, hitung ETA, dan siarkan `ambulance.location`. */
@Injectable()
export class TrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoService,
    private readonly realtime: RealtimeService,
  ) {}

  async record(ambulanceId: string, loc: LocationInput) {
    await this.prisma.ambulance.update({
      where: { id: ambulanceId },
      data: { lastLat: loc.lat, lastLng: loc.lng, lastHeading: loc.heading, lastLocationAt: loc.recordedAt },
    });
    const request = await this.prisma.emergencyRequest.findFirst({
      where: { ambulanceId, status: { in: TRACKED_STATUSES } },
      include: { destination: { select: { lat: true, lng: true } } },
      orderBy: { requestedAt: 'desc' },
    });
    if (!request) return;

    await this.prisma.ambulanceLocationLog.create({
      data: { requestId: request.id, ambulanceId, lat: loc.lat, lng: loc.lng, heading: loc.heading, speed: loc.speed, recordedAt: loc.recordedAt },
    });

    // ETA ke lokasi kejadian saat menjemput, ke FASKES tujuan saat membawa pasien
    let eta: number | null = null;
    if (request.status === 'DITERIMA' || request.status === 'DALAM_PERJALANAN') {
      eta = await this.geo.eta(`${request.id}:pickup`, loc, { lat: request.lat, lng: request.lng });
    } else if (request.status === 'MENUJU_FASKES' && request.destination) {
      eta = await this.geo.eta(`${request.id}:dropoff`, loc, request.destination);
    }
    if (eta !== request.etaSeconds) {
      await this.prisma.emergencyRequest.update({ where: { id: request.id }, data: { etaSeconds: eta } });
    }

    const payload = {
      request_id: request.id,
      lat: loc.lat,
      lng: loc.lng,
      heading: loc.heading,
      eta_seconds: eta,
      updated_at: loc.recordedAt,
    };
    this.realtime.toRequest(request.id, 'ambulance.location', payload);
  }
}
