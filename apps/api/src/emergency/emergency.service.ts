import { Injectable } from '@nestjs/common';
import { Patient, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AppError } from '../common/app-error';
import { jakartaDate } from '../common/format';
import { CryptoService } from '../core/crypto.service';
import { PrismaService } from '../core/prisma.service';
import { DispatchQueue } from '../dispatch/dispatch.queue';
import { StorageService } from '../storage/storage.service';
import { CreateRequestInput } from './emergency.schemas';
import { FullRequest, requestInclude } from './request.presenter';
import { ACTIVE_STATUSES, CANCELLABLE_STATUSES } from './status';
import { StatusService } from './status.service';

const MAX_PHOTOS = 3;
const PHOTO_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

@Injectable()
export class EmergencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly status: StatusService,
    private readonly storage: StorageService,
    private readonly dispatch: DispatchQueue,
  ) {}

  async create(userId: string, input: CreateRequestInput): Promise<FullRequest> {
    const existing = await this.prisma.emergencyRequest.findUnique({
      where: { reporterUserId_clientRequestId: { reporterUserId: userId, clientRequestId: input.client_request_id } },
      include: requestInclude,
    });
    if (existing) return existing;

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.phoneVerifiedAt) {
      throw new AppError('PHONE_NOT_VERIFIED', 'Verifikasi nomor HP Anda sebelum meminta ambulans.', 403);
    }
    const caseType = await this.prisma.caseType.findFirst({ where: { code: input.case_type_code, isActive: true } });
    if (!caseType) throw AppError.field('case_type_code', 'Tipe kasus tidak dikenal.');
    if (await this.activeFor(userId)) {
      throw AppError.conflict('ACTIVE_REQUEST_EXISTS', 'Anda masih memiliki permintaan ambulans yang aktif.');
    }

    const patient = await this.resolvePatient(userId, input);
    let request: FullRequest | null = null;
    for (let attempt = 0; attempt < 5 && !request; attempt++) {
      try {
        request = await this.prisma.$transaction(async (tx) => {
          const created = await tx.emergencyRequest.create({
            data: {
              code: await this.nextCode(tx),
              clientRequestId: input.client_request_id,
              reporterUserId: userId,
              patientId: patient.id,
              caseTypeId: caseType.id,
              caseTypeOther: input.case_type_code === 'LAINNYA' ? input.case_type_other : null,
              description: input.description,
              lat: input.location.lat,
              lng: input.location.lng,
              address: input.location.address,
            },
          });
          await tx.emergencyStatusLog.create({ data: { requestId: created.id, toStatus: 'MENUNGGU', actorUserId: userId } });
          return tx.emergencyRequest.findUniqueOrThrow({ where: { id: created.id }, include: requestInclude });
        });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
        const target = String(err.meta?.target ?? '');
        if (target.includes('client_request_id')) {
          return this.prisma.emergencyRequest.findUniqueOrThrow({
            where: { reporterUserId_clientRequestId: { reporterUserId: userId, clientRequestId: input.client_request_id } },
            include: requestInclude,
          });
        }
        if (!target.includes('code')) {
          throw AppError.conflict('ACTIVE_REQUEST_EXISTS', 'Anda masih memiliki permintaan ambulans yang aktif.');
        }
        // bentrok nomor kode → coba lagi
      }
    }
    if (!request) throw new Error('Gagal membuat kode permintaan');
    await this.dispatch.start(request.id);
    await this.status.publish(request);
    return request;
  }

  async addPhoto(userId: string, requestId: string, file: Express.Multer.File | undefined) {
    if (!file) throw AppError.field('photo', 'Foto wajib diunggah.');
    const ext = PHOTO_EXT[file.mimetype];
    if (!ext) throw AppError.field('photo', 'Format foto harus JPG, PNG, atau WEBP.');
    const request = await this.getOwned(userId, requestId);
    if ((await this.prisma.emergencyPhoto.count({ where: { requestId } })) >= MAX_PHOTOS) {
      throw AppError.field('photo', `Maksimal ${MAX_PHOTOS} foto per permintaan.`);
    }
    const key = `requests/${request.id}/${randomUUID()}.${ext}`;
    await this.storage.put(key, file.buffer);
    const photo = await this.prisma.emergencyPhoto.create({
      data: { requestId, objectKey: key, mimeType: file.mimetype, sizeBytes: file.size },
    });
    await this.status.publish(await this.status.load(requestId));
    return { id: photo.id, url: this.storage.signedUrl(key) };
  }

  async cancel(userId: string, requestId: string, reason: string | undefined) {
    const request = await this.getOwned(userId, requestId);
    if (!CANCELLABLE_STATUSES.includes(request.status)) {
      throw AppError.conflict('INVALID_STATUS_TRANSITION', 'Permintaan tidak dapat dibatalkan karena ambulans sudah tiba.');
    }
    if (request.status !== 'MENUNGGU' && !reason) throw AppError.field('reason', 'Alasan pembatalan wajib diisi.');
    return this.status.transition(requestId, 'DIBATALKAN', {
      actorUserId: userId,
      note: reason,
      data: { cancelReason: reason ?? null, cancelledById: userId },
    });
  }

  activeFor(userId: string) {
    return this.prisma.emergencyRequest.findFirst({
      where: { reporterUserId: userId, status: { in: ACTIVE_STATUSES } },
      include: requestInclude,
    });
  }

  async getOwned(userId: string, requestId: string): Promise<FullRequest> {
    const request = await this.prisma.emergencyRequest.findFirst({ where: { id: requestId, reporterUserId: userId }, include: requestInclude });
    if (!request) throw AppError.notFound('Permintaan tidak ditemukan.');
    return request;
  }

  async history(userId: string, skip: number, take: number) {
    const where = { reporterUserId: userId };
    const [items, total] = await Promise.all([
      this.prisma.emergencyRequest.findMany({ where, include: requestInclude, orderBy: { requestedAt: 'desc' }, skip, take }),
      this.prisma.emergencyRequest.count({ where }),
    ]);
    return { items, total };
  }

  /** Tentukan pasien: diri sendiri, pasien yang dipilih, pasien lama dengan identitas sama, atau pasien baru. */
  private async resolvePatient(userId: string, input: CreateRequestInput): Promise<Patient> {
    const p = input.patient;
    if (p.use_self) {
      const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      if (!user.nikEncrypted) throw AppError.field('patient.use_self', 'Lengkapi NIK di profil Anda terlebih dahulu.');
      const self = await this.prisma.patient.findFirst({ where: { ownerUserId: userId, isSelf: true, deletedAt: null } });
      const data = {
        name: user.name,
        nameUnknown: false,
        identityEncrypted: user.nikEncrypted,
        identityHash: user.nikHash,
        identityUnknown: false,
        birthDate: user.birthDate,
        gender: user.gender,
      };
      return self
        ? this.prisma.patient.update({ where: { id: self.id }, data })
        : this.prisma.patient.create({ data: { ...data, ownerUserId: userId, isSelf: true } });
    }
    if (p.patient_id) {
      const patient = await this.prisma.patient.findFirst({ where: { id: p.patient_id, ownerUserId: userId, deletedAt: null } });
      if (!patient) throw AppError.field('patient.patient_id', 'Pasien tidak ditemukan.');
      return patient;
    }
    const identityHash = p.identity_number ? this.crypto.blindIndex(p.identity_number) : null;
    const data = {
      name: p.name_unknown ? null : (p.name ?? null),
      nameUnknown: p.name_unknown,
      identityEncrypted: p.identity_number ? this.crypto.encrypt(p.identity_number) : null,
      identityHash,
      identityUnknown: p.identity_unknown,
    };
    if (identityHash) {
      const same = await this.prisma.patient.findFirst({ where: { ownerUserId: userId, identityHash, deletedAt: null } });
      if (same) return this.prisma.patient.update({ where: { id: same.id }, data: { name: data.name ?? same.name, nameUnknown: data.nameUnknown } });
    }
    return this.prisma.patient.create({ data: { ...data, ownerUserId: userId } });
  }

  /** Kode `SOS-YYYYMMDD-NNNN` berurutan per hari (WIB). */
  private async nextCode(tx: Prisma.TransactionClient): Promise<string> {
    const prefix = `SOS-${jakartaDate(new Date()).replace(/-/g, '')}-`;
    const last = await tx.emergencyRequest.findFirst({ where: { code: { startsWith: prefix } }, orderBy: { code: 'desc' }, select: { code: true } });
    const next = last ? Number(last.code.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(next).padStart(4, '0')}`;
  }
}
