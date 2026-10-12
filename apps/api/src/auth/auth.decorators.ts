import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  role: Role;
  facilityId: string | null;
}

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';

/** Endpoint tanpa autentikasi. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Batasi endpoint ke peran tertentu. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const STAFF_ROLES: Role[] = ['FACILITY_OPERATOR', 'FACILITY_ADMIN', 'SUPER_ADMIN'];

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});
