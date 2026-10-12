import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import { AppError } from '../common/app-error';
import { AppConfig } from '../config/app-config.service';
import { CryptoService } from '../core/crypto.service';
import { PrismaService } from '../core/prisma.service';
import { AuthUser } from './auth.decorators';

interface AccessClaims {
  sub: string;
  role: Role;
  fid: string | null;
}

/** Penerbitan & verifikasi access token (JWT) dan refresh token (opaque, dirotasi). */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async issue(user: Pick<User, 'id' | 'role' | 'facilityId'>) {
    const ttl = this.config.get('ACCESS_TOKEN_TTL_SECONDS');
    const claims: AccessClaims = { sub: user.id, role: user.role, fid: user.facilityId };
    const accessToken = await this.jwt.signAsync(claims, { secret: this.config.get('JWT_ACCESS_SECRET'), expiresIn: ttl });
    const refreshToken = this.crypto.randomToken(32);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.crypto.sha256(refreshToken),
        expiresAt: new Date(Date.now() + this.config.get('REFRESH_TOKEN_TTL_DAYS') * 86400000),
      },
    });
    return { access_token: accessToken, refresh_token: refreshToken, expires_in: ttl };
  }

  async verifyAccess(token: string): Promise<AuthUser> {
    try {
      const claims = await this.jwt.verifyAsync<AccessClaims>(token, { secret: this.config.get('JWT_ACCESS_SECRET') });
      return { id: claims.sub, role: claims.role, facilityId: claims.fid };
    } catch {
      throw AppError.unauthenticated();
    }
  }

  /** Tukar refresh token. Token yang sudah dicabut dipakai ulang → cabut semua sesi pengguna. */
  async rotate(refreshToken: string): Promise<User> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.crypto.sha256(refreshToken) },
      include: { user: true },
    });
    if (!record) throw AppError.unauthenticated();
    if (record.revokedAt) {
      await this.prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw AppError.unauthenticated();
    }
    if (record.expiresAt < new Date() || !record.user.isActive || record.user.deletedAt) throw AppError.unauthenticated();
    const revoked = await this.prisma.refreshToken.updateMany({ where: { id: record.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (revoked.count === 0) throw AppError.unauthenticated();
    return record.user;
  }

  async revoke(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.crypto.sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAll(userId: string) {
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  signResetToken(userId: string) {
    return this.jwt.signAsync({ sub: userId, purpose: 'reset' }, { secret: this.config.get('JWT_RESET_SECRET'), expiresIn: 900 });
  }

  async verifyResetToken(token: string): Promise<string> {
    try {
      const claims = await this.jwt.verifyAsync<{ sub: string; purpose: string }>(token, { secret: this.config.get('JWT_RESET_SECRET') });
      if (claims.purpose !== 'reset') throw new Error('purpose');
      return claims.sub;
    } catch {
      throw AppError.validation('Tautan reset password tidak valid atau kedaluwarsa.', [{ field: 'reset_token', message: 'Token tidak valid.' }]);
    }
  }
}
