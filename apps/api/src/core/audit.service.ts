import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/** Catatan audit akses data sensitif & perubahan penting (desain §10). */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(actorId: string | null, action: string, entity: string, entityId?: string | null, meta?: Prisma.InputJsonValue) {
    try {
      await this.prisma.auditLog.create({ data: { actorId, action, entity, entityId: entityId ?? null, meta } });
    } catch (err) {
      this.logger.warn(`Gagal menulis audit ${action}: ${(err as Error).message}`);
    }
  }
}
