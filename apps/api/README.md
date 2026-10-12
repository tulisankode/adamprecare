# Adam PreCare API

NestJS 11 + Prisma 6 (PostgreSQL 16 + PostGIS) + Redis 7 (BullMQ, Socket.IO adapter). Kontrak endpoint: [docs/api_contract.md](../../docs/api_contract.md).

## Konfigurasi

Salin `.env.example` ke `.env`. Rahasia wajib (string acak ≥ 32 karakter):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # JWT_ACCESS_SECRET, JWT_RESET_SECRET, FILE_URL_SECRET, HASH_PEPPER
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"      # DATA_ENCRYPTION_KEY (32 byte)
```

> `DATA_ENCRYPTION_KEY` mengenkripsi NIK/identitas pasien & kredensial SIMRS. Mengganti kunci membuat data lama tidak terbaca.

| Variabel | Keterangan |
|---|---|
| `GOOGLE_CLIENT_IDS` | Client ID Google Sign-In (dipisah koma). Kosong = login Google nonaktif. |
| `GOOGLE_MAPS_API_KEY` | Kosong = geocoding via OpenStreetMap Nominatim & ETA estimasi garis lurus (40 km/jam × 1,4). |
| `DISPATCH_*` | Batas waktu penawaran (60 dtk), eskalasi admin (180 dtk), tidak terlayani (600 dtk). |
| `DISPATCH_REQUIRE_CREW_ON_DUTY` | `true` = hanya FASKES dengan ambulans yang petugasnya sedang jaga yang ditawari. |

## Struktur

```
src/
  auth/          login (mobile & staf), OTP, Google, refresh token berotasi, guard & peran
  users/         /me (profil, password, nomor HP, perangkat push)
  content/       banner, artikel, tipe kasus, halaman statis, versi aplikasi, health
  geo/           geocoding & ETA (Google Maps / OSM)
  facilities/    direktori FASKES terdekat (PostGIS)
  emergency/     permintaan SOS, status & transisi, presenter, foto
  patients/      data pasien milik pengguna
  dispatch/      penawaran ke FASKES mitra & PSC 119, timeout, eskalasi (BullMQ)
  crew/          mode petugas: jaga, status tugas, lokasi GPS
  operator/      endpoint dashboard web (kasus, dashboard, tracking, laporan + Excel, ambulans, notifikasi)
  simrs/         integrasi SIMRS: adapter ADAMEDS + adapter tiruan, lookup No. RM
  realtime/      Socket.IO (path /realtime) + adapter Redis
  storage/       berkas privat + URL bertanda tangan
prisma/          schema, migrasi, seed
test/            e2e (database precare_test)
```

## Integrasi SIMRS ADAMEDS

Per FASKES, `facilities.medical_record_source = 'SIMRS'` dan satu baris `simrs_integrations`:

| Kolom | Nilai untuk ADAMEDS |
|---|---|
| `vendor` | `ADAMEDS` (`MOCK` = SIMRS tiruan untuk dev) |
| `config` | `{ "admisi_base_url": "http://<host>:8081" }` |
| `external_tenant_id` | `faskes_uuid` FASKES tersebut di ADAMEDS |
| `credentials_encrypted` | JSON `{ "api_key": "<API_KEY_CHECK_NORM>" }` terenkripsi |

Cara tercepat di dev: jalankan seed dengan variabel berikut agar RS Sehat Sentosa memakai ADAMEDS sungguhan:

```bash
SEED_ADAMEDS_ADMISI_URL=http://localhost:8081 SEED_ADAMEDS_API_KEY=... SEED_ADAMEDS_FASKES_UUID=... npm run db:seed
```

Alur: saat operator menerima kasus → job `simrs.lookup` memanggil `POST /api/v3/admisi/patient/check-patient` (NIK → `no_rm`), retry 3× bila ADAMEDS tidak dapat dihubungi, cek ulang tiap `SIMRS_RECHECK_INTERVAL_MINUTES` selama kasus berjalan, dan tombol "Sinkron ulang" di dashboard. Lihat desain §7.5.

## Belum terhubung (stub)

- Pengiriman OTP (SMS/WhatsApp/email): kode dicatat di log dan dikembalikan sebagai `dev_otp` di non-produksi.
- Push notification FCM: dicatat di log.
- Penyimpanan berkas: disk lokal (`UPLOAD_DIR`); siap diganti S3-compatible di `StorageService`.
- Integrasi API PSC 119 (`integration_mode = 'API'`): belum ada adapter; PSC memakai dashboard web.
