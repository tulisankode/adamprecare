import { z } from 'zod';

const csv = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  CORS_ORIGINS: csv,

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_RESET_SECRET: z.string().min(32),
  FILE_URL_SECRET: z.string().min(32),
  DATA_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, 'base64').length === 32, 'DATA_ENCRYPTION_KEY harus 32 byte base64'),
  HASH_PEPPER: z.string().min(16),

  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  UPLOAD_DIR: z.string().default('./uploads'),

  GOOGLE_CLIENT_IDS: csv,
  GOOGLE_MAPS_API_KEY: z.string().default(''),

  DISPATCH_OFFER_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(60),
  DISPATCH_ESCALATE_AFTER_SECONDS: z.coerce.number().int().positive().default(180),
  DISPATCH_UNSERVED_AFTER_SECONDS: z.coerce.number().int().positive().default(600),
  DISPATCH_REQUIRE_CREW_ON_DUTY: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  SIMRS_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  SIMRS_RECHECK_INTERVAL_MINUTES: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Konfigurasi environment tidak valid:\n${issues}`);
  }
  return parsed.data;
}
