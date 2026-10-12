import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SimrsStatus } from '@prisma/client';
import { AppConfig } from '../config/app-config.service';
import { CryptoService } from '../core/crypto.service';
import { PrismaService } from '../core/prisma.service';
import { StatusService } from '../emergency/status.service';
import { AdamedsAdapter } from './adameds.adapter';
import { MockSimrsAdapter } from './mock.adapter';
import { SimrsAdapter, SimrsCredentials, SimrsUnavailableError } from './simrs.adapter';
import { SimrsQueue } from './simrs.queue';

/** Status kasus yang masih perlu dicek ulang ke SIMRS (sudah diterima, belum final). */
const RECHECK_STATUSES = ['DITERIMA', 'DALAM_PERJALANAN', 'TIBA', 'MENUJU_FASKES', 'SAMPAI_DI_FASKES'] as const;

/**
 * Pencarian No. RM ke SIMRS (desain §7.5.2). Kegagalan SIMRS tidak pernah menghambat dispatch:
 * hasilnya hanya disimpan di `facility_patient_records` dan ditampilkan ke operator.
 */
@Injectable()
export class SimrsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SimrsService.name);
  private recheckTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly config: AppConfig,
    private readonly status: StatusService,
    private readonly queue: SimrsQueue,
    private readonly adameds: AdamedsAdapter,
    private readonly mock: MockSimrsAdapter,
  ) {}

  onModuleInit() {
    if (this.config.get('NODE_ENV') === 'test') return;
    const everyMs = this.config.get('SIMRS_RECHECK_INTERVAL_MINUTES') * 60000;
    this.recheckTimer = setInterval(() => this.recheckPending().catch((e) => this.logger.warn(`Recheck gagal: ${e.message}`)), everyMs);
  }

  onModuleDestroy() {
    if (this.recheckTimer) clearInterval(this.recheckTimer);
  }

  /**
   * @param final  true pada percobaan terakhir job → status ERROR disimpan walau error sementara.
   * @throws SimrsUnavailableError bila SIMRS tidak dapat dihubungi dan masih bisa dicoba ulang.
   */
  async lookup(requestId: string, opts: { force?: boolean; final?: boolean } = {}): Promise<void> {
    const request = await this.prisma.emergencyRequest.findUnique({
      where: { id: requestId },
      include: { patient: true, facility: { include: { simrsIntegration: true } } },
    });
    const facility = request?.facility;
    if (!request || !facility || facility.medicalRecordSource !== 'SIMRS') return;

    const key = { facilityId_patientId: { facilityId: facility.id, patientId: request.patientId } };
    const existing = await this.prisma.facilityPatientRecord.findUnique({ where: key });
    if (!opts.force && existing?.medicalRecordNo) return;

    const integration = facility.simrsIntegration;
    const identity = this.crypto.decrypt(request.patient.identityEncrypted);
    let status: SimrsStatus;
    let medicalRecordNo: string | null = existing?.medicalRecordNo ?? null;
    let message: string | null = null;

    if (!integration?.isActive) {
      status = 'NOT_CONFIGURED';
      message = 'Integrasi SIMRS belum dikonfigurasi.';
    } else if (!identity) {
      status = 'NO_IDENTITY';
      message = 'Identitas pasien tidak diketahui — isi No. RM manual.';
    } else {
      try {
        const result = await this.adapterFor(integration.vendor).lookupByIdentity(
          {
            config: (integration.config ?? {}) as Record<string, unknown>,
            externalTenantId: integration.externalTenantId,
            credentials: this.credentials(integration.credentialsEncrypted),
            timeoutMs: this.config.get('SIMRS_HTTP_TIMEOUT_MS'),
          },
          identity,
        );
        if (result.status === 'FOUND') {
          status = 'FOUND';
          medicalRecordNo = result.medicalRecordNo;
        } else {
          status = 'NOT_FOUND';
          message = result.message ?? 'Belum terdaftar di SIMRS.';
        }
      } catch (err) {
        const retryable = err instanceof SimrsUnavailableError;
        this.logger.warn(`Lookup SIMRS ${request.code} gagal: ${(err as Error).message}`);
        if (retryable && !opts.final) throw err;
        status = 'ERROR';
        message = (err as Error).message;
      }
    }

    await this.prisma.facilityPatientRecord.upsert({
      where: key,
      create: {
        facilityId: facility.id,
        patientId: request.patientId,
        medicalRecordNo,
        source: 'SIMRS',
        simrsStatus: status,
        simrsMessage: message,
        syncedAt: status === 'FOUND' ? new Date() : null,
      },
      update: {
        medicalRecordNo,
        ...(status === 'FOUND' ? { source: 'SIMRS' as const, syncedAt: new Date() } : {}),
        simrsStatus: status,
        simrsMessage: message,
      },
    });
    await this.status.publish(await this.status.load(requestId));
  }

  /** Cek ulang berkala pasien yang belum ditemukan selama kasusnya masih berjalan. */
  async recheckPending() {
    const requests = await this.prisma.emergencyRequest.findMany({
      where: { status: { in: [...RECHECK_STATUSES] }, facility: { medicalRecordSource: 'SIMRS' } },
      select: { id: true, facilityId: true, patientId: true },
    });
    for (const r of requests) {
      const record = await this.prisma.facilityPatientRecord.findUnique({
        where: { facilityId_patientId: { facilityId: r.facilityId!, patientId: r.patientId } },
      });
      if (!record?.medicalRecordNo && record?.simrsStatus !== 'NO_IDENTITY') await this.queue.lookup(r.id);
    }
  }

  private adapterFor(vendor: string): SimrsAdapter {
    return vendor === 'ADAMEDS' ? this.adameds : this.mock;
  }

  private credentials(encrypted: string | null): SimrsCredentials {
    const raw = this.crypto.decrypt(encrypted);
    return raw ? (JSON.parse(raw) as SimrsCredentials) : {};
  }
}
