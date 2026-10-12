import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

/** Pengirim event realtime ke room (lihat docs/api_contract.md §6). */
@Injectable()
export class RealtimeService {
  server?: Server;

  toUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  toFacility(facilityId: string, event: string, payload: unknown) {
    this.server?.to(`facility:${facilityId}`).emit(event, payload);
  }

  toRequest(requestId: string, event: string, payload: unknown) {
    this.server?.to(`request:${requestId}`).emit(event, payload);
  }

  toAdmins(event: string, payload: unknown) {
    this.server?.to('admin').emit(event, payload);
  }
}
