import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthUser } from '../auth/auth.decorators';
import { TokenService } from '../auth/token.service';
import { PrismaService } from '../core/prisma.service';
import { RealtimeService } from './realtime.service';

type AuthedSocket = Socket & { data: { user?: AuthUser } };

/**
 * Socket.IO di path `/realtime`. Klien masuk otomatis ke room user/facility/admin,
 * lalu dapat `subscribe` ke room `request:{id}` bila berhak melihat permintaan tersebut.
 */
@WebSocketGateway({ path: '/realtime', cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server) {
    this.realtime.server = server;
  }

  async handleConnection(client: AuthedSocket) {
    const token = (client.handshake.auth?.token as string | undefined) ?? client.handshake.headers.authorization?.replace(/^Bearer /, '');
    try {
      if (!token) throw new Error('no token');
      const user = await this.tokens.verifyAccess(token);
      client.data.user = user;
      await client.join(`user:${user.id}`);
      if (user.facilityId && user.role !== 'USER' && user.role !== 'CREW') await client.join(`facility:${user.facilityId}`);
      if (user.role === 'SUPER_ADMIN') await client.join('admin');
    } catch {
      client.emit('error', { code: 'UNAUTHENTICATED', message: 'Token tidak valid.' });
      client.disconnect(true);
    }
  }

  @SubscribeMessage('subscribe')
  async subscribe(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { request_id?: string }) {
    const user = client.data.user;
    if (!user || !body?.request_id) return { ok: false };
    if (!(await this.canView(user, body.request_id))) return { ok: false, error: 'FORBIDDEN' };
    await client.join(`request:${body.request_id}`);
    return { ok: true };
  }

  @SubscribeMessage('unsubscribe')
  async unsubscribe(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { request_id?: string }) {
    if (body?.request_id) await client.leave(`request:${body.request_id}`);
    return { ok: true };
  }

  private async canView(user: AuthUser, requestId: string): Promise<boolean> {
    try {
      const req = await this.prisma.emergencyRequest.findUnique({
        where: { id: requestId },
        select: { reporterUserId: true, facilityId: true, ambulanceId: true, offers: { select: { facilityId: true, status: true } } },
      });
      if (!req) return false;
      if (user.role === 'SUPER_ADMIN') return true;
      if (user.role === 'USER') return req.reporterUserId === user.id;
      if (user.role === 'CREW') {
        const crew = await this.prisma.ambulanceCrew.findUnique({ where: { userId: user.id } });
        return Boolean(crew && crew.ambulanceId === req.ambulanceId);
      }
      return Boolean(
        user.facilityId &&
          (req.facilityId === user.facilityId || req.offers.some((o) => o.facilityId === user.facilityId && o.status === 'OFFERED')),
      );
    } catch (err) {
      this.logger.warn(`subscribe gagal: ${(err as Error).message}`);
      return false;
    }
  }
}
