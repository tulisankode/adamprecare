/**
 * Data contoh untuk development & demo. MENGHAPUS semua data lalu mengisi ulang.
 * Semua akun memakai password `password123` — JANGAN dijalankan di produksi.
 *
 * Opsional — hubungkan RS Sehat Sentosa ke ADAMEDS sungguhan (bukan SIMRS tiruan):
 *   SEED_ADAMEDS_ADMISI_URL=http://localhost:8081 SEED_ADAMEDS_API_KEY=... SEED_ADAMEDS_FASKES_UUID=... npm run db:seed
 */
import { AmbulanceType, CasePriority, DispatchStrategy, FacilityType, Prisma, PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { existsSync } from 'fs';
import { CryptoService } from '../src/core/crypto.service';

if (existsSync('.env')) process.loadEnvFile('.env');
if (process.env.NODE_ENV === 'production') throw new Error('Seed tidak boleh dijalankan di produksi.');

const prisma = new PrismaClient();
const crypto = new CryptoService({ get: (key: string) => process.env[key] } as never);
const PASSWORD = 'password123';

const caseTypes: { code: string; name: string; icon: string; color: string; priority: CasePriority; strategy: DispatchStrategy }[] = [
  { code: 'KECELAKAAN', name: 'Kecelakaan', icon: 'car-crash', color: '#4A9FE8', priority: 'TINGGI', strategy: 'PARALEL' },
  { code: 'NYERI_DADA', name: 'Nyeri Dada', icon: 'heart-pulse', color: '#8CCB5E', priority: 'TINGGI', strategy: 'PARALEL' },
  { code: 'SESAK_NAFAS', name: 'Sesak Nafas', icon: 'lungs', color: '#F5C842', priority: 'TINGGI', strategy: 'PARALEL' },
  { code: 'BENCANA_ALAM', name: 'Bencana Alam', icon: 'house-crack', color: '#B57EDC', priority: 'TINGGI', strategy: 'PSC_DULU' },
  { code: 'LAINNYA', name: 'Lainnya', icon: 'clipboard-list', color: '#E58BC9', priority: 'NORMAL', strategy: 'BERURUTAN' },
];

const polyclinics = ['Poli Umum', 'Poli THT', 'Poli Kandungan', 'Poli Tulang', 'Poli Kulit', 'Poli Mata', 'Poli Gigi', 'Poli Anak', 'Poli Jantung', 'Poli Saraf'];

interface FacilitySeed {
  key: string;
  name: string;
  type: FacilityType;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  polyclinics?: string[];
  acceptsEmergency?: boolean;
  /** [minLng, minLat, maxLng, maxLat] — wilayah layanan PSC 119 (perkiraan kotak batas). */
  serviceArea?: [number, number, number, number];
  simrs?: boolean;
  ambulances?: { name: string; plate: string; type: AmbulanceType; crew: string }[];
  staff?: { username: string; name: string; role: Role }[];
}

const facilities: FacilitySeed[] = [
  {
    key: 'rss',
    name: 'RS Sehat Sentosa',
    type: 'RUMAH_SAKIT',
    address: 'Jl. Raya Sukolilo Mulia No. 12, Keputih, Kec. Sukolilo, Surabaya, Jawa Timur 60111',
    lat: -7.2905,
    lng: 112.7958,
    phone: '+62315550000',
    polyclinics: ['Poli Umum', 'Poli Jantung', 'Poli Tulang', 'Poli Anak', 'Poli Saraf'],
    simrs: true,
    ambulances: [
      { name: 'Ambulan 001', plate: 'L 1234 XYZ', type: 'PASIEN', crew: 'petugas01' },
      { name: 'Ambulan 002', plate: 'L 5678 XYZ', type: 'GAWAT_DARURAT', crew: 'petugas02' },
    ],
    staff: [
      { username: 'operator.rss', name: 'Operator RS Sehat Sentosa', role: 'FACILITY_OPERATOR' },
      { username: 'admin.rss', name: 'Admin RS Sehat Sentosa', role: 'FACILITY_ADMIN' },
    ],
  },
  {
    key: 'bhakti',
    name: 'RS Bhakti Husada',
    type: 'RUMAH_SAKIT',
    address: 'Jl. Raya Darmo No. 90, Darmo, Kec. Wonokromo, Surabaya, Jawa Timur 60241',
    lat: -7.2862,
    lng: 112.7379,
    phone: '+62315671234',
    polyclinics: ['Poli Umum', 'Poli Kandungan', 'Poli Mata', 'Poli Gigi'],
    ambulances: [{ name: 'Ambulan BH-01', plate: 'L 2201 BH', type: 'PASIEN', crew: 'petugas.bhakti01' }],
    staff: [{ username: 'operator.bhakti', name: 'Operator RS Bhakti Husada', role: 'FACILITY_OPERATOR' }],
  },
  {
    key: 'pkm-keputih',
    name: 'Puskesmas Keputih',
    type: 'PUSKESMAS',
    address: 'Jl. Keputih Tegal No. 3, Keputih, Kec. Sukolilo, Surabaya, Jawa Timur 60111',
    lat: -7.2934,
    lng: 112.8041,
    phone: '+62315943210',
    polyclinics: ['Poli Umum', 'Poli Gigi', 'Poli Anak'],
    acceptsEmergency: false,
  },
  {
    key: 'dawuhan',
    name: 'Klinik Pratama Dawuhan',
    type: 'KLINIK',
    address: 'Jl. Magelang - Yogyakarta No.Km.5, Japunan, Danurejo, Kec. Mertoyudan, Kabupaten Magelang',
    lat: -7.5236,
    lng: 110.2337,
    phone: '+622933202654',
    polyclinics: ['Poli Umum', 'Poli THT', 'Poli Kandungan', 'Poli Tulang', 'Poli Kulit', 'Poli Mata', 'Poli Gigi', 'Poli Anak'],
    ambulances: [{ name: 'Ambulan DW-01', plate: 'AA 1501 DW', type: 'PASIEN', crew: 'petugas.dawuhan01' }],
    staff: [{ username: 'operator.dawuhan', name: 'Operator Klinik Dawuhan', role: 'FACILITY_OPERATOR' }],
  },
  {
    key: 'rsud-magelang',
    name: 'RSUD Tidar Kota Magelang',
    type: 'RUMAH_SAKIT',
    address: 'Jl. Tidar No. 30A, Kemirirejo, Kec. Magelang Tengah, Kota Magelang, Jawa Tengah 56125',
    lat: -7.4831,
    lng: 110.2191,
    phone: '+62293362260',
    polyclinics: ['Poli Umum', 'Poli Jantung', 'Poli Saraf', 'Poli Anak'],
  },
  {
    key: 'psc-sby',
    name: 'PSC 119 Kota Surabaya',
    type: 'PSC_119',
    address: 'Jl. Jemursari No. 197, Kec. Wonocolo, Surabaya, Jawa Timur 60237',
    lat: -7.3204,
    lng: 112.7452,
    phone: '119',
    serviceArea: [112.59, -7.36, 112.85, -7.18],
    ambulances: [{ name: 'PSC SBY 01', plate: 'L 1191 PS', type: 'GAWAT_DARURAT', crew: 'petugas.psc.sby01' }],
    staff: [{ username: 'operator.psc.sby', name: 'Operator PSC 119 Surabaya', role: 'FACILITY_OPERATOR' }],
  },
  {
    key: 'psc-mgl',
    name: 'PSC 119 Kabupaten Magelang',
    type: 'PSC_119',
    address: 'Jl. Soekarno-Hatta No. 7, Mertoyudan, Kabupaten Magelang, Jawa Tengah 56172',
    lat: -7.5508,
    lng: 110.2131,
    phone: '119',
    serviceArea: [110.05, -7.75, 110.45, -7.35],
    ambulances: [{ name: 'PSC MGL 01', plate: 'AA 1190 PS', type: 'GAWAT_DARURAT', crew: 'petugas.psc.mgl01' }],
    staff: [{ username: 'operator.psc.mgl', name: 'Operator PSC 119 Magelang', role: 'FACILITY_OPERATOR' }],
  },
];

const articles = [
  { slug: 'cacar-api-lansia-vaksinasi', title: 'Penyakit Cacar Api pada Lansia Bisa Dicegah dengan Vaksinasi' },
  { slug: 'pertolongan-pertama-kecelakaan', title: 'Pertolongan Pertama pada Korban Kecelakaan Lalu Lintas' },
  { slug: 'kenali-gejala-serangan-jantung', title: 'Kenali Gejala Serangan Jantung Sejak Dini' },
  { slug: 'sesak-nafas-kapan-ke-igd', title: 'Sesak Nafas: Kapan Harus Segera ke IGD?' },
  { slug: 'siaga-bencana-keluarga', title: 'Siaga Bencana: Tas Darurat yang Wajib Disiapkan Keluarga' },
];

async function wipe() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations', 'spatial_ref_sys')`;
  if (tables.length) {
    await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  }
}

async function main() {
  await wipe();
  const passwordHash = await argon2.hash(PASSWORD);

  for (const [i, c] of caseTypes.entries()) {
    await prisma.caseType.create({
      data: { code: c.code, name: c.name, icon: c.icon, color: c.color, priority: c.priority, dispatchStrategy: c.strategy, sortOrder: i },
    });
  }
  const polyIds = new Map<string, string>();
  for (const name of polyclinics) polyIds.set(name, (await prisma.polyclinic.create({ data: { name } })).id);

  await prisma.user.create({ data: { role: 'SUPER_ADMIN', name: 'Super Admin', username: 'superadmin', passwordHash } });

  for (const f of facilities) {
    const useAdameds = f.simrs && process.env.SEED_ADAMEDS_ADMISI_URL && process.env.SEED_ADAMEDS_API_KEY && process.env.SEED_ADAMEDS_FASKES_UUID;
    const facility = await prisma.facility.create({
      data: {
        name: f.name,
        type: f.type,
        address: f.address,
        lat: f.lat,
        lng: f.lng,
        phone: f.phone,
        photoUrl: f.type === 'PSC_119' ? null : `https://picsum.photos/seed/${f.key}/800/450`,
        acceptsEmergency: f.acceptsEmergency ?? true,
        showInDirectory: f.type !== 'PSC_119',
        medicalRecordSource: f.simrs ? 'SIMRS' : 'MANUAL',
        medicalRecordFormat: f.simrs ? '^\\d{2}-\\d{2}-\\d{2}$' : null,
        polyclinics: f.polyclinics ? { create: f.polyclinics.map((p) => ({ polyclinicId: polyIds.get(p)! })) } : undefined,
        simrsIntegration: f.simrs
          ? {
              create: useAdameds
                ? {
                    vendor: 'ADAMEDS',
                    config: { admisi_base_url: process.env.SEED_ADAMEDS_ADMISI_URL } as Prisma.InputJsonValue,
                    externalTenantId: process.env.SEED_ADAMEDS_FASKES_UUID,
                    authMode: 'API_KEY',
                    credentialsEncrypted: crypto.encrypt(JSON.stringify({ api_key: process.env.SEED_ADAMEDS_API_KEY })),
                  }
                : { vendor: 'MOCK', config: {} },
            }
          : undefined,
      },
    });
    if (f.serviceArea) {
      const [minLng, minLat, maxLng, maxLat] = f.serviceArea;
      await prisma.$executeRaw`
        UPDATE facilities SET service_area = ST_Multi(ST_MakeEnvelope(${minLng}, ${minLat}, ${maxLng}, ${maxLat}, 4326))::geography
        WHERE id = ${facility.id}::uuid`;
    }
    for (const s of f.staff ?? []) {
      await prisma.user.create({ data: { role: s.role, name: s.name, username: s.username, passwordHash, facilityId: facility.id } });
    }
    for (const a of f.ambulances ?? []) {
      const ambulance = await prisma.ambulance.create({
        data: { facilityId: facility.id, name: a.name, plateNumber: a.plate, type: a.type, lastLat: f.lat, lastLng: f.lng, lastLocationAt: new Date() },
      });
      const crew = await prisma.user.create({
        data: { role: 'CREW', name: `Petugas ${a.name}`, username: a.crew, passwordHash, facilityId: facility.id, phone: null },
      });
      await prisma.ambulanceCrew.create({ data: { userId: crew.id, ambulanceId: ambulance.id, onDuty: true } });
    }
  }

  const nik = '3578010101900002';
  const demo = await prisma.user.create({
    data: {
      role: 'USER',
      name: 'Adam',
      email: 'demo@adamprecare.id',
      phone: '+6281234567890',
      phoneVerifiedAt: new Date(),
      passwordHash,
      nikEncrypted: crypto.encrypt(nik),
      nikHash: crypto.blindIndex(nik),
      birthDate: new Date('1990-01-01T00:00:00Z'),
      gender: 'L',
    },
  });
  await prisma.patient.create({
    data: { ownerUserId: demo.id, name: 'Siti Aminah', identityEncrypted: crypto.encrypt('3578015505850004'), identityHash: crypto.blindIndex('3578015505850004'), ageYears: 41, gender: 'P' },
  });

  for (const [i, a] of articles.entries()) {
    await prisma.article.create({
      data: {
        slug: a.slug,
        title: a.title,
        coverUrl: `https://picsum.photos/seed/${a.slug}/800/450`,
        excerpt: `${a.title} — ringkasan artikel kesehatan dari tim Adam PreCare.`,
        bodyHtml: `<p>${a.title}.</p><p>Konten contoh untuk pengembangan. Ganti dengan artikel yang ditinjau tenaga medis.</p>`,
        publishedAt: new Date(Date.now() - i * 86400000),
      },
    });
  }
  for (const [i, title] of ['Apakah anda dalam keadaan darurat?', 'Kenali gejala serangan jantung', 'Simpan nomor darurat 119'].entries()) {
    await prisma.banner.create({ data: { title, imageUrl: `https://picsum.photos/seed/banner${i}/1200/500`, sortOrder: i } });
  }
  await prisma.page.createMany({
    data: [
      { slug: 'faq', title: 'FAQ', bodyHtml: '<h3>Kapan saya menekan tombol SOS?</h3><p>Saat ada kondisi darurat medis yang membutuhkan ambulans.</p>' },
      { slug: 'kebijakan-privasi', title: 'Kebijakan Privasi', bodyHtml: '<p>Draf kebijakan privasi — wajib ditinjau tim legal sesuai UU PDP.</p>' },
      { slug: 'syarat-ketentuan', title: 'Syarat dan Ketentuan', bodyHtml: '<p>Draf syarat dan ketentuan — wajib ditinjau tim legal.</p>' },
    ],
  });
  await prisma.appVersion.createMany({
    data: [
      { platform: 'android', version: '1.0.0', minSupportedVersion: '1.0.0', releaseNotes: 'Rilis pertama Adam PreCare.' },
      { platform: 'ios', version: '1.0.0', minSupportedVersion: '1.0.0', releaseNotes: 'Rilis pertama Adam PreCare.' },
    ],
  });

  console.log(`Seed selesai. Semua akun memakai password "${PASSWORD}".`);
  console.log('  Web  : superadmin, operator.rss, admin.rss, operator.bhakti, operator.psc.sby, operator.dawuhan, operator.psc.mgl');
  console.log('  Mobile pengguna: demo@adamprecare.id (atau +6281234567890)');
  console.log('  Mobile petugas : petugas01, petugas02, petugas.bhakti01, petugas.psc.sby01, petugas.dawuhan01, petugas.psc.mgl01');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
