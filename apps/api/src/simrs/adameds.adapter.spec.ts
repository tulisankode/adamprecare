import { createServer, IncomingMessage, Server } from 'http';
import { AddressInfo } from 'net';
import { AdamedsAdapter } from './adameds.adapter';
import { SimrsConnection, SimrsUnavailableError } from './simrs.adapter';

/** Server tiruan yang meniru `POST /api/v3/admisi/patient/check-patient` milik ADAMEDS. */
describe('AdamedsAdapter', () => {
  let server: Server;
  let baseUrl: string;
  let lastRequest: { headers: IncomingMessage['headers']; body: Record<string, string>; url?: string } | undefined;
  let respond: (body: Record<string, string>) => [number, unknown];

  const conn = (): SimrsConnection => ({
    config: { admisi_base_url: baseUrl },
    externalTenantId: 'faskes-uuid-1',
    credentials: { api_key: 'kunci-rahasia' },
    timeoutMs: 2000,
  });

  beforeAll(async () => {
    server = createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const body = JSON.parse(raw || '{}');
        lastRequest = { headers: req.headers, body, url: req.url };
        const [status, payload] = respond(body);
        res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(payload));
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it('mengirim NIK sebagai KTP dengan header x-api-key & faskes-uuid dan membaca payload.no_rm', async () => {
    respond = () => [200, { message: 'OK', payload: { uuid: 'p1', no_rm: '00-01-23', name: 'Adam' } }];
    const result = await new AdamedsAdapter().lookupByIdentity(conn(), '3578010101900002');
    expect(result).toEqual({ status: 'FOUND', medicalRecordNo: '00-01-23', patientName: 'Adam' });
    expect(lastRequest?.url).toBe('/api/v3/admisi/patient/check-patient');
    expect(lastRequest?.headers['x-api-key']).toBe('kunci-rahasia');
    expect(lastRequest?.headers['faskes-uuid']).toBe('faskes-uuid-1');
    expect(lastRequest?.body).toEqual({ faskes_uuid: 'faskes-uuid-1', identity: 'KTP', no_identity: '3578010101900002' });
  });

  it('404 "Pasien belum terdaftar" → NOT_FOUND', async () => {
    respond = () => [404, { message: 'Pasien belum terdaftar', payload: { noRm: null } }];
    expect((await new AdamedsAdapter().lookupByIdentity(conn(), '3578010101900002')).status).toBe('NOT_FOUND');
  });

  it('identitas bukan NIK/paspor tidak dikirim ke SIMRS', async () => {
    lastRequest = undefined;
    const result = await new AdamedsAdapter().lookupByIdentity(conn(), '1234567');
    expect(result.status).toBe('NOT_FOUND');
    expect(lastRequest).toBeUndefined();
  });

  it('paspor dikirim sebagai Passport', async () => {
    respond = () => [200, { payload: { no_rm: '00-00-09' } }];
    await new AdamedsAdapter().lookupByIdentity(conn(), 'a12345678');
    expect(lastRequest?.body.identity).toBe('Passport');
    expect(lastRequest?.body.no_identity).toBe('A12345678');
  });

  it('5xx → SimrsUnavailableError (dicoba ulang), 401 → error konfigurasi', async () => {
    respond = () => [500, { message: 'boom' }];
    await expect(new AdamedsAdapter().lookupByIdentity(conn(), '3578010101900002')).rejects.toBeInstanceOf(SimrsUnavailableError);
    respond = () => [401, { message: 'unauthorized' }];
    await expect(new AdamedsAdapter().lookupByIdentity(conn(), '3578010101900002')).rejects.toThrow('ditolak');
  });

  it('konfigurasi tidak lengkap → error jelas', async () => {
    await expect(new AdamedsAdapter().lookupByIdentity({ ...conn(), credentials: {} }, '3578010101900002')).rejects.toThrow('belum lengkap');
  });
});
