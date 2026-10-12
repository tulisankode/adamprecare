import { Injectable } from '@nestjs/common';
import { OtpPurpose, Prisma, Role, User } from '@prisma/client';
import * as argon2 from 'argon2';
import { OAuth2Client } from 'google-auth-library';
import { AppError } from '../common/app-error';
import { maskEmail, maskPhone } from '../common/format';
import { normalizePhone } from '../common/validators';
import { AppConfig } from '../config/app-config.service';
import { PrismaService } from '../core/prisma.service';
import { UserPresenter } from '../users/user.presenter';
import { STAFF_ROLES } from './auth.decorators';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

const MOBILE_ROLES: Role[] = ['USER', 'CREW'];

@Injectable()
export class AuthService {
  private readonly google = new OAuth2Client();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly otp: OtpService,
    private readonly users: UserPresenter,
    private readonly config: AppConfig,
  ) {}

  async register(input: { name: string; email: string; phone: string; password: string }) {
    const existing = await this.prisma.user.findFirst({ where: { OR: [{ email: input.email }, { phone: input.phone }] } });
    if (existing) {
      const details = [];
      if (existing.email === input.email) details.push({ field: 'email', message: 'Email sudah terdaftar.' });
      if (existing.phone === input.phone) details.push({ field: 'phone', message: 'Nomor HP sudah terdaftar.' });
      throw AppError.conflict('DUPLICATE', 'Akun sudah terdaftar.', details);
    }
    const user = await this.prisma.user.create({
      data: { role: 'USER', name: input.name, email: input.email, phone: input.phone, passwordHash: await argon2.hash(input.password) },
    });
    const sent = await this.otp.send(input.phone, 'REGISTER');
    return { user: this.users.present(user), otp_sent_to: maskPhone(input.phone), ...sent };
  }

  /** Kirim ulang OTP. Untuk RESET_PASSWORD selalu "berhasil" agar keberadaan akun tidak bocor. */
  async sendOtp(rawTarget: string, purpose: OtpPurpose) {
    const target = this.normalizeTarget(rawTarget);
    const user = await this.findByIdentifier(target);
    const masked = target.includes('@') ? maskEmail(target) : maskPhone(target);
    if (purpose === 'RESET_PASSWORD') {
      if (!user) return { otp_sent_to: masked };
      return { otp_sent_to: masked, ...(await this.otp.send(target, purpose)) };
    }
    // REGISTER / VERIFY_PHONE: target adalah nomor HP yang belum terverifikasi
    if (!user || user.phone !== target) throw AppError.notFound('Nomor HP tidak ditemukan.');
    if (user.phoneVerifiedAt) throw AppError.field('target', 'Nomor HP sudah terverifikasi.');
    return { otp_sent_to: masked, ...(await this.otp.send(target, purpose)) };
  }

  async verifyOtp(rawTarget: string, purpose: OtpPurpose, code: string) {
    const target = this.normalizeTarget(rawTarget);
    await this.otp.verify(target, purpose, code);
    const user = await this.findByIdentifier(target);
    if (!user) throw AppError.notFound('Akun tidak ditemukan.');
    if (purpose === 'RESET_PASSWORD') return { reset_token: await this.tokens.signResetToken(user.id) };
    const verified = await this.prisma.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: new Date() } });
    return this.session(verified);
  }

  async login(identifier: string, password: string) {
    const user = await this.findByIdentifier(this.normalizeTarget(identifier));
    await this.assertPassword(user, password);
    if (!MOBILE_ROLES.includes(user!.role)) throw AppError.forbidden('Akun staf hanya dapat login melalui dashboard web.');
    return this.session(user!);
  }

  async staffLogin(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username }, include: { facility: true } });
    await this.assertPassword(user, password);
    if (!STAFF_ROLES.includes(user!.role)) throw AppError.forbidden('Akun ini tidak memiliki akses ke dashboard.');
    return this.session(user!);
  }

  async googleLogin(idToken: string) {
    const audience = this.config.get('GOOGLE_CLIENT_IDS');
    if (!audience.length) throw AppError.validation('Login Google belum dikonfigurasi di server.');
    let payload;
    try {
      payload = (await this.google.verifyIdToken({ idToken, audience })).getPayload();
    } catch {
      throw AppError.invalidCredentials('Token Google tidak valid.');
    }
    if (!payload?.sub || !payload.email || !payload.email_verified) throw AppError.invalidCredentials('Akun Google tidak valid.');
    const email = payload.email.toLowerCase();
    let user = await this.prisma.user.findFirst({ where: { OR: [{ googleSub: payload.sub }, { email }] }, include: { facility: true } });
    if (user && !MOBILE_ROLES.includes(user.role)) throw AppError.forbidden('Akun staf hanya dapat login melalui dashboard web.');
    if (!user) {
      user = await this.prisma.user.create({
        data: { role: 'USER', name: payload.name ?? email.split('@')[0], email, googleSub: payload.sub, avatarUrl: payload.picture },
        include: { facility: true },
      });
    } else if (!user.googleSub) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { googleSub: payload.sub }, include: { facility: true } });
    }
    this.assertActive(user);
    return { ...(await this.session(user)), profile_incomplete: !user.phoneVerifiedAt };
  }

  async refresh(refreshToken: string) {
    const user = await this.tokens.rotate(refreshToken);
    const full = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { facility: true } });
    return this.session(full);
  }

  async resetPassword(resetToken: string, newPassword: string) {
    const userId = await this.tokens.verifyResetToken(resetToken);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await argon2.hash(newPassword) } });
    await this.tokens.revokeAll(userId);
  }

  logout(refreshToken: string) {
    return this.tokens.revoke(refreshToken);
  }

  private async session(user: User) {
    const full = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { facility: true } });
    return { ...(await this.tokens.issue(full)), user: this.users.present(full) };
  }

  private normalizeTarget(raw: string): string {
    const value = raw.trim();
    if (value.includes('@')) return value.toLowerCase();
    return normalizePhone(value) ?? value;
  }

  private findByIdentifier(identifier: string) {
    const where: Prisma.UserWhereInput = identifier.includes('@')
      ? { email: identifier }
      : identifier.startsWith('+62')
        ? { phone: identifier }
        : { username: identifier };
    return this.prisma.user.findFirst({ where: { ...where, deletedAt: null }, include: { facility: true } });
  }

  private async assertPassword(user: User | null, password: string) {
    // Hash dummy agar waktu respons sama walau akun tidak ada
    const hash = user?.passwordHash ?? '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG';
    const valid = await argon2.verify(hash, password).catch(() => false);
    if (!user || !user.passwordHash || !valid) throw AppError.invalidCredentials();
    this.assertActive(user);
  }

  private assertActive(user: User) {
    if (!user.isActive || user.deletedAt) throw AppError.forbidden('Akun dinonaktifkan. Hubungi admin.');
  }
}
