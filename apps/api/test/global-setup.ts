import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { join } from 'path';

/** Siapkan database `precare_test`: buat bila belum ada, migrasi, lalu seed ulang. */
export default async function globalSetup() {
  require('./setup-env');
  const testUrl = process.env.DATABASE_URL!;
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = '/postgres';
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  const exists = await admin.$queryRaw<unknown[]>`SELECT 1 FROM pg_database WHERE datname = 'precare_test'`;
  if (!exists.length) await admin.$executeRawUnsafe('CREATE DATABASE precare_test');
  await admin.$disconnect();

  const cwd = join(__dirname, '..');
  const env = { ...process.env, DATABASE_URL: testUrl };
  execSync('npx prisma migrate deploy', { cwd, env, stdio: 'ignore' });
  execSync('npx ts-node --transpile-only prisma/seed.ts', { cwd, env, stdio: 'ignore' });
}
