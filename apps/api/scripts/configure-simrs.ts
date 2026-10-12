/**
 * Hubungkan sebuah FASKES Adam PreCare ke SIMRS (tanpa menghapus data lain).
 *
 *   SIMRS_API_KEY=... npm run simrs:configure -- --facility "RS Sehat Sentosa" --vendor ADAMEDS \
 *     --url http://localhost:8081 --tenant <faskes_uuid ADAMEDS>
 *
 *   npm run simrs:configure -- --facility "RS Sehat Sentosa" --vendor MOCK      # kembali ke SIMRS tiruan
 *   npm run simrs:configure -- --facility "Klinik Pratama Dawuhan" --manual     # No. RM diisi manual
 *
 * API key dibaca dari env `SIMRS_API_KEY` (bukan argumen) agar tidak tersimpan di riwayat shell.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { existsSync } from 'fs';
import { parseArgs } from 'util';
import { CryptoService } from '../src/core/crypto.service';

if (existsSync('.env')) process.loadEnvFile('.env');

const { values } = parseArgs({
  options: {
    facility: { type: 'string' },
    vendor: { type: 'string' },
    url: { type: 'string' },
    tenant: { type: 'string' },
    manual: { type: 'boolean', default: false },
  },
});

async function main() {
  if (!values.facility) throw new Error('--facility wajib diisi (nama FASKES).');
  const prisma = new PrismaClient();
  const crypto = new CryptoService({ get: (key: string) => process.env[key] } as never);
  try {
    const facility = await prisma.facility.findFirst({ where: { name: values.facility } });
    if (!facility) throw new Error(`FASKES "${values.facility}" tidak ditemukan.`);

    if (values.manual) {
      await prisma.facility.update({ where: { id: facility.id }, data: { medicalRecordSource: 'MANUAL' } });
      await prisma.simrsIntegration.updateMany({ where: { facilityId: facility.id }, data: { isActive: false } });
      console.log(`${facility.name}: No. RM diisi manual (integrasi SIMRS dinonaktifkan).`);
      return;
    }

    const vendor = values.vendor?.toUpperCase();
    if (vendor !== 'ADAMEDS' && vendor !== 'MOCK') throw new Error('--vendor harus ADAMEDS atau MOCK.');
    let data: Omit<Prisma.SimrsIntegrationUncheckedCreateInput, 'facilityId'> = { vendor: 'MOCK', config: {}, isActive: true };
    if (vendor === 'ADAMEDS') {
      const apiKey = process.env.SIMRS_API_KEY;
      if (!values.url || !values.tenant || !apiKey) throw new Error('ADAMEDS butuh --url, --tenant, dan env SIMRS_API_KEY.');
      data = {
        vendor: 'ADAMEDS',
        config: { admisi_base_url: values.url },
        externalTenantId: values.tenant,
        authMode: 'API_KEY',
        credentialsEncrypted: crypto.encrypt(JSON.stringify({ api_key: apiKey })),
        isActive: true,
      };
    }
    await prisma.$transaction([
      prisma.facility.update({ where: { id: facility.id }, data: { medicalRecordSource: 'SIMRS' } }),
      prisma.simrsIntegration.upsert({ where: { facilityId: facility.id }, create: { ...data, facilityId: facility.id }, update: data }),
    ]);
    console.log(`${facility.name}: terhubung ke SIMRS ${vendor}${vendor === 'ADAMEDS' ? ` (${values.url}, faskes ${values.tenant})` : ''}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
