import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { OtpPurpose } from '@prisma/client';
import { AppError } from '../common/app-error';
import { AppConfig } from '../config/app-config.service';
import { CryptoService } from '../core/crypto.service';
import { PrismaService } from '../core/prisma.service';

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

/**
 * Kode OTP 6 digit. Pengiriman SMS/WhatsApp/email belum terhubung ke gateway:
 * di non-produksi kode dikembalikan sebagai `dev_otp` dan dicatat di log.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly config: AppConfig,
  ) {}

  async send(target: string, purpose: OtpPurpose): Promise<{ dev_otp?: string }> {
    const now = Date.now();
    const recent = await this.prisma.otpCode.findMany({
      where: { target, purpose, createdAt: { gte: new Date(now - 3600000) } },
      orderBy: { createdAt: 'desc' },
    });
    if (recent[0] && now - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS) {
      throw new AppError('RATE_LIMITED', 'Tunggu 60 detik sebelum meminta kode baru.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (recent.length >= MAX_PER_HOUR) {
      throw new AppError('RATE_LIMITED', 'Terlalu banyak permintaan kode. Coba lagi dalam 1 jam.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const code = this.crypto.otpCode();
    await this.prisma.otpCode.create({
      data: { target, purpose, codeHash: this.crypto.sha256(`${target}:${code}`), expiresAt: new Date(now + OTP_TTL_MS) },
    });
    // TODO(gateway): kirim lewat SMS/WhatsApp/email provider.
    if (this.config.isProduction) return {};
    this.logger.log(`OTP ${purpose} untuk ${target}: ${code}`);
    return { dev_otp: code };
  }

  /** Verifikasi & konsumsi kode. */
  async verify(target: string, purpose: OtpPurpose, code: string): Promise<void> {
    const otp = await this.prisma.otpCode.findFirst({
      where: { target, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const invalid = new AppError('OTP_INVALID', 'Kode OTP salah atau sudah kedaluwarsa.', HttpStatus.UNPROCESSABLE_ENTITY);
    if (!otp || otp.expiresAt < new Date() || otp.attempts >= MAX_ATTEMPTS) throw invalid;
    if (!this.crypto.safeEqual(otp.codeHash, this.crypto.sha256(`${target}:${code}`))) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw invalid;
    }
    const consumed = await this.prisma.otpCode.updateMany({ where: { id: otp.id, consumedAt: null }, data: { consumedAt: new Date() } });
    if (consumed.count === 0) throw invalid;
  }
}
