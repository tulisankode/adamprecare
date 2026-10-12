import { z } from 'zod';
import { passwordSchema, phoneSchema } from '../common/validators';

export const registerSchema = z.object({
  name: z.string({ required_error: 'Nama wajib diisi.' }).trim().min(2, 'Nama minimal 2 karakter.').max(100),
  email: z.string({ required_error: 'Email wajib diisi.' }).trim().toLowerCase().email('Format email tidak valid.'),
  phone: phoneSchema,
  password: passwordSchema,
});

export const otpPurposeSchema = z.enum(['REGISTER', 'RESET_PASSWORD', 'VERIFY_PHONE'], {
  errorMap: () => ({ message: 'Tujuan OTP tidak valid.' }),
});

export const otpSendSchema = z.object({
  target: z.string({ required_error: 'Target wajib diisi.' }).trim().min(3),
  purpose: otpPurposeSchema,
});

export const otpVerifySchema = otpSendSchema.extend({
  code: z.string().regex(/^\d{6}$/, 'Kode OTP harus 6 digit.'),
});

export const loginSchema = z.object({
  identifier: z.string({ required_error: 'Email/No. Telepon wajib diisi.' }).trim().min(3, 'Email/No. Telepon wajib diisi.'),
  password: z.string({ required_error: 'Password wajib diisi.' }).min(1, 'Password wajib diisi.'),
});

export const staffLoginSchema = z.object({
  username: z.string({ required_error: 'Username wajib diisi.' }).trim().min(1, 'Username wajib diisi.'),
  password: z.string({ required_error: 'Password wajib diisi.' }).min(1, 'Password wajib diisi.'),
});

export const googleSchema = z.object({ id_token: z.string().min(10, 'id_token wajib diisi.') });

export const refreshSchema = z.object({ refresh_token: z.string().min(10, 'refresh_token wajib diisi.') });

export const resetPasswordSchema = z.object({
  reset_token: z.string().min(10),
  new_password: passwordSchema,
});
