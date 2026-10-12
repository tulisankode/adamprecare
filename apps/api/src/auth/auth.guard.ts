import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { AppError } from '../common/app-error';
import { AuthUser, IS_PUBLIC, ROLES } from './auth.decorators';
import { TokenService } from './token.service';

/** Guard global: verifikasi access token lalu cek peran (@Roles). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw AppError.unauthenticated();
    const user: AuthUser = await this.tokens.verifyAccess(header.slice(7));
    req.user = user;

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, targets);
    if (roles?.length && !roles.includes(user.role)) throw AppError.forbidden();
    return true;
  }
}
