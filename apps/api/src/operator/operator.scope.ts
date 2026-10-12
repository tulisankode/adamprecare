import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../common/app-error';
import { AuthUser } from '../auth/auth.decorators';

export const facilityParamSchema = z.object({ facility_id: z.string().uuid().optional() });

/**
 * Penyedia yang menjadi konteks staf. Operator/admin penyedia → penyedianya sendiri;
 * SUPER_ADMIN → `facility_id` dari query atau null (= semua penyedia).
 */
export function scopeFacility(user: AuthUser, facilityIdParam?: string): string | null {
  if (user.role === 'SUPER_ADMIN') return facilityIdParam ?? null;
  if (!user.facilityId) throw AppError.forbidden('Akun belum ditautkan ke penyedia.');
  return user.facilityId;
}

export function requireFacility(user: AuthUser, facilityIdParam?: string): string {
  const fid = scopeFacility(user, facilityIdParam);
  if (!fid) throw AppError.forbidden('Pilih penyedia terlebih dahulu.');
  return fid;
}

/** Kasus yang terlihat oleh penyedia: yang ia tangani + yang sedang ditawarkan kepadanya. */
export function visibleRequests(facilityId: string | null): Prisma.EmergencyRequestWhereInput {
  if (!facilityId) return {};
  return { OR: [{ facilityId }, { offers: { some: { facilityId, status: 'OFFERED' } } }] };
}

/** Panggilan yang pernah masuk ke penyedia (untuk statistik dashboard). */
export function incomingRequests(facilityId: string | null): Prisma.EmergencyRequestWhereInput {
  if (!facilityId) return {};
  return { OR: [{ facilityId }, { offers: { some: { facilityId } } }] };
}
