import { z } from 'zod';

const PHONE_PATTERN = /^\+628\d{7,12}$/;

/** Normalisasi nomor HP Indonesia ke format E.164 (+628…). Null bila tidak valid. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, '');
  let phone = digits;
  if (phone.startsWith('08')) phone = `+62${phone.slice(1)}`;
  else if (phone.startsWith('628')) phone = `+${phone}`;
  return PHONE_PATTERN.test(phone) ? phone : null;
}

export const phoneSchema = z
  .string({ required_error: 'Nomor HP wajib diisi.' })
  .transform((v, ctx) => {
    const phone = normalizePhone(v);
    if (!phone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Format nomor HP tidak valid.' });
      return z.NEVER;
    }
    return phone;
  });

export const passwordSchema = z
  .string({ required_error: 'Password wajib diisi.' })
  .min(8, 'Password minimal 8 karakter.')
  .max(128, 'Password terlalu panjang.');

export const nikSchema = z.string().regex(/^\d{16}$/, 'NIK harus 16 digit angka.');

/** Nomor identitas umum (NIK, paspor, dll): 6–20 karakter alfanumerik. */
export const identitySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{6,20}$/, 'Nomor identitas harus 6–20 karakter huruf/angka.');

export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD.')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'Tanggal tidak valid.');

export const genderSchema = z.enum(['L', 'P'], { errorMap: () => ({ message: 'Jenis kelamin harus L atau P.' }) });

export const latSchema = z.coerce.number().min(-90).max(90);
export const lngSchema = z.coerce.number().min(-180).max(180);

export const uuidSchema = z.string().uuid('ID tidak valid.');
