import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/core/prisma.service';
import { configureApp } from '../src/main';

const PASSWORD = 'password123';
const SURABAYA_KEPUTIH = { lat: -7.2797, lng: 112.7975, address: 'Eastern Park AB, Keputih, Surabaya' };
const MAGELANG_MERTOYUDAN = { lat: -7.53, lng: 110.23, address: 'Mertoyudan, Kabupaten Magelang' };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Alur SOS end-to-end', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;

  const login = async (identifier: string) =>
    (await http.post('/v1/auth/login').send({ identifier, password: PASSWORD }).expect(200)).body.data.access_token as string;
  const staff = async (username: string) =>
    (await http.post('/v1/auth/staff/login').send({ username, password: PASSWORD }).expect(200)).body.data.access_token as string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const sos = (token: string, body: Record<string, unknown>) =>
    http
      .post('/v1/emergency-requests')
      .set(auth(token))
      .send({ client_request_id: randomUUID(), description: 'Uji otomatis', ...body });

  /** Tunggu sampai kondisi terpenuhi (job BullMQ berjalan asinkron). */
  async function waitFor<T>(fn: () => Promise<T | undefined | null | false>, timeoutMs = 15000): Promise<T> {
    const until = Date.now() + timeoutMs;
    for (;;) {
      const v = await fn();
      if (v) return v;
      if (Date.now() > until) throw new Error('waitFor timeout');
      await sleep(250);
    }
  }

  const offersFor = (requestId: string) =>
    prisma.dispatchOffer.findMany({ where: { requestId }, include: { facility: { select: { name: true, type: true } } }, orderBy: { offeredAt: 'asc' } });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    await configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app?.close();
  });

  it('menolak login staf di endpoint mobile dan sebaliknya', async () => {
    const r1 = await http.post('/v1/auth/login').send({ identifier: 'operator.rss', password: PASSWORD });
    expect(r1.status).toBe(403);
    const r2 = await http.post('/v1/auth/staff/login').send({ username: 'petugas01', password: PASSWORD });
    expect(r2.status).toBe(403);
    const r3 = await http.post('/v1/auth/login').send({ identifier: 'demo@adamprecare.id', password: 'salah' });
    expect(r3.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('alur lengkap: paralel ke FASKES + PSC, terima, SIMRS, petugas sampai Diperiksa', async () => {
    const user = await login('demo@adamprecare.id');
    const op = await staff('operator.rss');
    const psc = await staff('operator.psc.sby');
    const crew = await login('petugas01');

    const created = await sos(user, { case_type_code: 'KECELAKAAN', patient: { use_self: true }, location: SURABAYA_KEPUTIH }).expect(201);
    const id = created.body.data.id;
    expect(created.body.data.status).toBe('MENUNGGU');

    // Kasus aktif kedua ditolak
    const second = await sos(user, { case_type_code: 'NYERI_DADA', patient: { use_self: true }, location: SURABAYA_KEPUTIH });
    expect(second.body.error.code).toBe('ACTIVE_REQUEST_EXISTS');

    const offers = await waitFor(async () => {
      const o = await offersFor(id);
      return o.length >= 2 && o;
    });
    expect(offers.map((o) => o.facility.type).sort()).toEqual(['PSC_119', 'RUMAH_SAKIT']);

    const amb = (await http.get('/v1/operator/ambulances?status=TERSEDIA&type=PASIEN').set(auth(op)).expect(200)).body.data[0];
    const accepted = await http.post(`/v1/operator/requests/${id}/accept`).set(auth(op)).send({ ambulance_id: amb.id }).expect(200);
    expect(accepted.body.data.status_badge).toBe('DIPROSES');

    const pscAmb = (await http.get('/v1/operator/ambulances?status=TERSEDIA').set(auth(psc)).expect(200)).body.data[0];
    const late = await http.post(`/v1/operator/requests/${id}/accept`).set(auth(psc)).send({ ambulance_id: pscAmb.id });
    expect(late.body.error.code).toBe('ALREADY_TAKEN');

    // SIMRS tiruan: NIK demo berakhiran genap → ditemukan
    const detail = await waitFor(async () => {
      const d = (await http.get(`/v1/operator/requests/${id}`).set(auth(op))).body.data;
      return d.simrs_status === 'FOUND' && d;
    });
    expect(detail.medical_record_no).toMatch(/^\d{2}-\d{2}-\d{2}$/);

    for (const status of ['DALAM_PERJALANAN', 'TIBA']) {
      await http.post(`/v1/crew/assignments/${id}/status`).set(auth(crew)).send({ status }).expect(200);
    }
    await http.post('/v1/crew/location').set(auth(crew)).send({ lat: -7.28, lng: 112.79, heading: 90 }).expect(200);
    const noDest = await http.post(`/v1/crew/assignments/${id}/status`).set(auth(crew)).send({ status: 'MENUJU_FASKES' });
    expect(noDest.status).toBe(400);
    await http
      .post(`/v1/crew/assignments/${id}/status`)
      .set(auth(crew))
      .send({ status: 'MENUJU_FASKES', destination_facility_id: (await prisma.facility.findFirstOrThrow({ where: { name: 'RS Sehat Sentosa' } })).id })
      .expect(200);
    await http.post(`/v1/crew/assignments/${id}/status`).set(auth(crew)).send({ status: 'SAMPAI_DI_FASKES' }).expect(200);
    const done = await http.post(`/v1/crew/assignments/${id}/status`).set(auth(crew)).send({ status: 'SELESAI' }).expect(200);
    expect(done.body.data.status_badge).toBe('DIPERIKSA');

    // Status final tidak bisa diubah lagi
    const again = await http.post(`/v1/crew/assignments/${id}/status`).set(auth(crew)).send({ status: 'TIBA' });
    expect(again.body.error.code).toBe('INVALID_STATUS_TRANSITION');

    const timeline = (await http.get(`/v1/operator/requests/${id}`).set(auth(op))).body.data.timeline.map((t: { label: string }) => t.label);
    expect(timeline).toEqual(['Panggil', 'Diproses', 'Dalam Perjalanan', 'Tiba di Lokasi', 'Menuju RS', 'Sampai di RS', 'Diperiksa']);
    expect((await prisma.ambulance.findUniqueOrThrow({ where: { id: amb.id } })).status).toBe('TERSEDIA');

    const report = await http.get('/v1/operator/reports').set(auth(op)).expect(200);
    expect(report.body.data.some((r: { request_id: string }) => r.request_id === id)).toBe(true);
    const xlsx = await http.get('/v1/operator/reports/export?format=xlsx').set(auth(op)).expect(200);
    expect(xlsx.headers['content-disposition']).toContain('.xlsx');
  });

  it('BERURUTAN: penawaran kedaluwarsa pindah ke FASKES berikutnya, lalu TIDAK_TERLAYANI', async () => {
    const user = await login('demo@adamprecare.id');
    const created = await sos(user, {
      case_type_code: 'LAINNYA',
      case_type_other: 'Pingsan',
      patient: { name: 'Uji Timeout', identity_unknown: true },
      location: SURABAYA_KEPUTIH,
    }).expect(201);
    const id = created.body.data.id;

    // Penawaran pertama ke satu FASKES saja (berurutan), kedaluwarsa 5 dtk → FASKES berikutnya
    const offers = await waitFor(async () => {
      const o = await offersFor(id);
      return o.length >= 2 && o;
    }, 20000);
    expect(offers[0].status).toBe('EXPIRED');
    expect(offers[0].facility.type).not.toBe('PSC_119');

    const escalated = await waitFor(() => prisma.emergencyRequest.findFirst({ where: { id, escalatedAt: { not: null } } }));
    expect(escalated).toBeTruthy();
    const final = await waitFor(() => prisma.emergencyRequest.findFirst({ where: { id, status: 'TIDAK_TERLAYANI' } }), 25000);
    expect(final.status).toBe('TIDAK_TERLAYANI');
    const view = (await http.get(`/v1/emergency-requests/${id}`).set(auth(user)).expect(200)).body.data;
    expect(view.status_label).toContain('119');
    const admin = await staff('superadmin');
    const notif = (await http.get('/v1/operator/notifications').set(auth(admin)).expect(200)).body;
    expect(notif.meta.unread_count).toBeGreaterThan(0);
  });

  it('tolak oleh operator → ditawarkan ke penyedia lain; batal oleh pelapor menarik penawaran', async () => {
    const user = await login('demo@adamprecare.id');
    const dawuhan = await staff('operator.dawuhan');
    const created = await sos(user, {
      case_type_code: 'NYERI_DADA',
      patient: { name: 'Pasien Magelang', identity_number: '3308010101800003' },
      location: MAGELANG_MERTOYUDAN,
    }).expect(201);
    const id = created.body.data.id;
    await waitFor(async () => (await offersFor(id)).length >= 2);

    await http.post(`/v1/operator/requests/${id}/reject`).set(auth(dawuhan)).send({ reason: 'Ambulans sedang perawatan' }).expect(200);
    const rejected = await prisma.dispatchOffer.findFirstOrThrow({ where: { requestId: id, facility: { name: 'Klinik Pratama Dawuhan' } } });
    expect(rejected.status).toBe('REJECTED');

    const cancelled = await http.post(`/v1/emergency-requests/${id}/cancel`).set(auth(user)).send({}).expect(200);
    expect(cancelled.body.data.status).toBe('DIBATALKAN');
    const open = await prisma.dispatchOffer.count({ where: { requestId: id, status: 'OFFERED' } });
    expect(open).toBe(0);
  });

  it('pasien: CRUD & umur tampil sesuai data', async () => {
    const user = await login('demo@adamprecare.id');
    const p = await http.post('/v1/patients').set(auth(user)).send({ name: 'Pasien Baru', identity_number: '1234567890' }).expect(201);
    expect(p.body.data.age_text).toBe('-');
    const u = await http.patch(`/v1/patients/${p.body.data.id}`).set(auth(user)).send({ age_years: 20, gender: 'L' }).expect(200);
    expect(u.body.data.age_text).toBe('20 Th');
    await http.delete(`/v1/patients/${p.body.data.id}`).set(auth(user)).expect(200);
    await http.get(`/v1/patients/${p.body.data.id}`).set(auth(user)).expect(404);
  });
});
