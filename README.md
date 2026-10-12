# Adam PreCare

Platform permintaan ambulans darurat (pre-hospital & incident emergency system): aplikasi mobile untuk masyarakat & petugas ambulans, dashboard web untuk operator FASKES mitra / PSC 119, dan API yang terintegrasi dengan SIMRS ADAMEDS.

| Bagian | Lokasi | Teknologi |
|---|---|---|
| API (REST + Socket.IO + worker antrean) | [apps/api](apps/api) | NestJS 11, Prisma 6, PostgreSQL 16 + PostGIS, Redis 7, BullMQ |
| Dashboard web | [apps/web](apps/web) | Next.js 15, React 19, Tailwind CSS 4, TanStack Query, Leaflet |
| Aplikasi mobile | dibangun di emergent.sh dari [docs/brief_mobile_emergent.md](docs/brief_mobile_emergent.md) | Expo (React Native) |

Dokumen:

- [docs/desain_system.md](docs/desain_system.md) — rancangan sistem
- [docs/api_contract.md](docs/api_contract.md) — kontrak API (sumber kebenaran untuk web & mobile)
- [docs/brief_mobile_emergent.md](docs/brief_mobile_emergent.md) — brief pembuatan aplikasi mobile

## Menjalankan di lokal

Prasyarat: Node.js ≥ 20, Docker Desktop.

```bash
npm install                      # dari root (npm workspaces)
npm run infra:up                 # PostgreSQL+PostGIS (port 55432) & Redis (port 56379)

cp apps/api/.env.example apps/api/.env   # lalu isi rahasia (lihat apps/api/README.md)
npm run prisma:deploy -w apps/api
npm run db:seed -w apps/api      # data contoh, semua akun berpassword password123

npm run dev:api                  # http://localhost:4000/v1
npm run dev:web                  # http://localhost:3000
```

Akun contoh (password `password123`):

| Peran | Login |
|---|---|
| Super admin (web) | `superadmin` |
| Operator RS Sehat Sentosa — SIMRS tiruan aktif (web) | `operator.rss`, admin penyedia `admin.rss` |
| Operator PSC 119 Surabaya / Magelang (web) | `operator.psc.sby`, `operator.psc.mgl` |
| Operator lain (web) | `operator.bhakti`, `operator.dawuhan` |
| Pengguna (mobile) | `demo@adamprecare.id` atau `081234567890` |
| Petugas ambulans (mobile) | `petugas01`, `petugas02`, `petugas.psc.sby01`, `petugas.dawuhan01`, … |

## Pengujian

```bash
npm test -w apps/api             # unit test (format, adapter ADAMEDS)
npm run test:e2e -w apps/api     # e2e: database terpisah precare_test, butuh Docker berjalan
npm run lint -w apps/web && npm run build -w apps/web
```
