import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import * as argon2 from 'argon2';
import { z } from 'zod';
import { AppError } from '../common/app-error';
import { ok, success } from '../common/response';
import { dateOnlySchema, genderSchema, nikSchema, passwordSchema, phoneSchema } from '../common/validators';
import { ZodPipe } from '../common/zod.pipe';
import { AuthUser, CurrentUser, STAFF_ROLES } from '../auth/auth.decorators';
import { OtpService } from '../auth/otp.service';
import { TokenService } from '../auth/token.service';
import { maskPhone } from '../common/format';
import { CryptoService } from '../core/crypto.service';
import { PrismaService } from '../core/prisma.service';
import { UserPresenter } from './user.presenter';

const updateMeSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter.').max(100).optional(),
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._-]{3,50}$/, 'Username 3–50 karakter (huruf, angka, titik, garis bawah, strip).')
    .optional(),
  nik: nikSchema.nullable().optional(),
  birth_date: dateOnlySchema.nullable().optional(),
  gender: genderSchema.nullable().optional(),
  avatar_url: z.string().url('URL avatar tidak valid.').nullable().optional(),
});

const passwordChangeSchema = z.object({
  current_password: z.string().optional(),
  new_password: passwordSchema,
});

const phoneChangeSchema = z.object({ phone: phoneSchema });

const deviceSchema = z.object({
  fcm_token: z.string().min(10, 'fcm_token wajib diisi.'),
  platform: z.enum(['android', 'ios']),
});

@Controller('me')
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly users: UserPresenter,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
  ) {}

  @Get()
  async me(@CurrentUser() auth: AuthUser) {
    return ok(this.users.present(await this.load(auth.id)));
  }

  @Patch()
  async update(@CurrentUser() auth: AuthUser, @Body(new ZodPipe(updateMeSchema)) body: z.infer<typeof updateMeSchema>) {
    const isStaff = STAFF_ROLES.includes(auth.role);
    if (body.username !== undefined && !isStaff) throw AppError.field('username', 'Username hanya untuk akun staf.');
    if (body.username) {
      const taken = await this.prisma.user.findFirst({ where: { username: body.username, NOT: { id: auth.id } } });
      if (taken) throw AppError.conflict('DUPLICATE', 'Username sudah dipakai.', [{ field: 'username', message: 'Username sudah dipakai.' }]);
    }
    const user = await this.prisma.user.update({
      where: { id: auth.id },
      data: {
        name: body.name,
        username: body.username,
        avatarUrl: body.avatar_url,
        gender: body.gender,
        birthDate: body.birth_date === undefined ? undefined : body.birth_date ? new Date(`${body.birth_date}T00:00:00Z`) : null,
        ...(body.nik === undefined
          ? {}
          : body.nik === null
            ? { nikEncrypted: null, nikHash: null }
            : { nikEncrypted: this.crypto.encrypt(body.nik), nikHash: this.crypto.blindIndex(body.nik) }),
      },
      include: { facility: true },
    });
    return ok(this.users.present(user));
  }

  @Post('password')
  @HttpCode(200)
  async changePassword(@CurrentUser() auth: AuthUser, @Body(new ZodPipe(passwordChangeSchema)) body: z.infer<typeof passwordChangeSchema>) {
    const user = await this.load(auth.id);
    if (user.passwordHash) {
      const valid = body.current_password ? await argon2.verify(user.passwordHash, body.current_password).catch(() => false) : false;
      if (!valid) throw AppError.field('current_password', 'Password lama salah.');
    }
    await this.prisma.user.update({ where: { id: auth.id }, data: { passwordHash: await argon2.hash(body.new_password) } });
    await this.tokens.revokeAll(auth.id);
    return success();
  }

  /** Set nomor HP (akun Google) lalu kirim OTP VERIFY_PHONE. */
  @Post('phone')
  @HttpCode(200)
  async setPhone(@CurrentUser() auth: AuthUser, @Body(new ZodPipe(phoneChangeSchema)) body: z.infer<typeof phoneChangeSchema>) {
    const user = await this.load(auth.id);
    if (user.phoneVerifiedAt && user.phone === body.phone) throw AppError.field('phone', 'Nomor HP sudah terverifikasi.');
    const taken = await this.prisma.user.findFirst({ where: { phone: body.phone, NOT: { id: auth.id } } });
    if (taken) throw AppError.conflict('DUPLICATE', 'Nomor HP sudah dipakai akun lain.', [{ field: 'phone', message: 'Nomor HP sudah dipakai.' }]);
    await this.prisma.user.update({ where: { id: auth.id }, data: { phone: body.phone, phoneVerifiedAt: null } });
    return ok({ otp_sent_to: maskPhone(body.phone), ...(await this.otp.send(body.phone, 'VERIFY_PHONE')) });
  }

  @Post('devices')
  @HttpCode(200)
  async registerDevice(@CurrentUser() auth: AuthUser, @Body(new ZodPipe(deviceSchema)) body: z.infer<typeof deviceSchema>) {
    await this.prisma.device.upsert({
      where: { fcmToken: body.fcm_token },
      create: { userId: auth.id, fcmToken: body.fcm_token, platform: body.platform },
      update: { userId: auth.id, platform: body.platform, lastSeenAt: new Date() },
    });
    return success();
  }

  private load(id: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id }, include: { facility: true } });
  }
}
