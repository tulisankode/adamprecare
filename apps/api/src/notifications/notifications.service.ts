import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../core/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

interface NotificationInput {
  type: string;
  title: string;
  body: string;
  requestId?: string;
}

/**
 * Notifikasi in-app untuk staf (lonceng dashboard) + push ke perangkat mobile.
 * Push FCM belum terhubung: dicatat di log sampai kredensial Firebase disiapkan.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Kirim ke semua staf aktif sebuah penyedia. */
  async notifyFacility(facilityId: string, input: NotificationInput) {
    const staff = await this.prisma.user.findMany({
      where: { facilityId, isActive: true, deletedAt: null, role: { in: ['FACILITY_OPERATOR', 'FACILITY_ADMIN'] } },
      select: { id: true },
    });
    await this.createFor(staff.map((s) => s.id), input);
  }

  async notifyAdmins(input: NotificationInput) {
    const admins = await this.prisma.user.findMany({ where: { role: 'SUPER_ADMIN', isActive: true, deletedAt: null }, select: { id: true } });
    await this.createFor(admins.map((a) => a.id), input);
  }

  /** Push ke perangkat mobile pengguna/petugas. */
  async push(userId: string, title: string, body: string, data: Record<string, string> = {}) {
    const devices = await this.prisma.device.findMany({ where: { userId }, select: { fcmToken: true } });
    if (!devices.length) return;
    // TODO(fcm): kirim lewat Firebase Admin SDK.
    this.logger.log(`PUSH → ${userId} (${devices.length} perangkat): ${title} — ${body} ${JSON.stringify(data)}`);
  }

  private async createFor(userIds: string[], input: NotificationInput) {
    for (const userId of userIds) {
      const n = await this.prisma.notification.create({
        data: { userId, type: input.type, title: input.title, body: input.body, requestId: input.requestId },
      });
      this.realtime.toUser(userId, 'notification.created', {
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        request_id: n.requestId,
        read_at: null,
        created_at: n.createdAt,
      });
    }
  }
}
