import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { ok, success } from '../common/response';
import { ZodPipe } from '../common/zod.pipe';
import { Public } from './auth.decorators';
import {
  googleSchema,
  loginSchema,
  otpSendSchema,
  otpVerifySchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  staffLoginSchema,
} from './auth.schemas';
import { AuthService } from './auth.service';

@Public()
@Throttle({ default: { limit: 20, ttl: 60000 } })
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(@Body(new ZodPipe(registerSchema)) body: z.infer<typeof registerSchema>) {
    return ok(await this.auth.register(body));
  }

  @Post('otp/send')
  @HttpCode(200)
  async sendOtp(@Body(new ZodPipe(otpSendSchema)) body: z.infer<typeof otpSendSchema>) {
    return ok(await this.auth.sendOtp(body.target, body.purpose));
  }

  @Post('otp/verify')
  @HttpCode(200)
  async verifyOtp(@Body(new ZodPipe(otpVerifySchema)) body: z.infer<typeof otpVerifySchema>) {
    return ok(await this.auth.verifyOtp(body.target, body.purpose, body.code));
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodPipe(loginSchema)) body: z.infer<typeof loginSchema>) {
    return ok(await this.auth.login(body.identifier, body.password));
  }

  @Post('staff/login')
  @HttpCode(200)
  async staffLogin(@Body(new ZodPipe(staffLoginSchema)) body: z.infer<typeof staffLoginSchema>) {
    return ok(await this.auth.staffLogin(body.username, body.password));
  }

  @Post('google')
  @HttpCode(200)
  async google(@Body(new ZodPipe(googleSchema)) body: z.infer<typeof googleSchema>) {
    return ok(await this.auth.googleLogin(body.id_token));
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async refresh(@Body(new ZodPipe(refreshSchema)) body: z.infer<typeof refreshSchema>) {
    return ok(await this.auth.refresh(body.refresh_token));
  }

  @Post('password/reset')
  @HttpCode(200)
  async resetPassword(@Body(new ZodPipe(resetPasswordSchema)) body: z.infer<typeof resetPasswordSchema>) {
    await this.auth.resetPassword(body.reset_token, body.new_password);
    return success();
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Body(new ZodPipe(refreshSchema)) body: z.infer<typeof refreshSchema>) {
    await this.auth.logout(body.refresh_token);
    return success();
  }
}
