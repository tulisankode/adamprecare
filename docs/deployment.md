# Deployment & CI/CD — Adam PreCare

## Lingkungan

| Lingkungan | Mesin | URL |
|---|---|---|
| Staging | Mac mini `10.8.0.246` (VPN), user `adamlabs` | Web https://precare.adamlabs.dev (Cloudflare → :3100; juga http://10.8.0.246:3100 di VPN) · API https://api-precare.adamlabs.dev/v1 (Cloudflare → :4000; juga http://10.8.0.246:4000/v1 di VPN) · Realtime path `/realtime` |

Staging dipakai bersama banyak layanan lain (±80 container). Port Adam PreCare: **3100** (web; 3000 sudah dipakai) dan **4000** (API). PostgreSQL & Redis staging tidak dibuka ke host.

## Alur Git

```
feature/xxx ──PR──▶ main ──fast-forward──▶ staging ──(otomatis)──▶ deploy ke Mac mini
```

1. Kerjakan di branch fitur, buka Pull Request ke `main`. **CI** (`.github/workflows/ci.yml`) wajib hijau:
   typecheck, unit test, e2e API (PostgreSQL+PostGIS & Redis), lint & build web.
2. Setelah merge ke `main`, promosikan ke staging dengan fast-forward (tanpa commit baru di `staging`):
   ```bash
   git fetch origin
   git push origin origin/main:staging
   ```
3. Push ke `staging` menjalankan **Deploy Staging** (`.github/workflows/deploy-staging.yml`): CI → job deploy
   di runner self-hosted (`[self-hosted, macOS, staging]`) → `deploy/staging/deploy.sh`.

Jangan commit langsung di `staging` dan jangan mengubah kode di server — server hanya menarik (pull) commit dari GitHub.

## Apa yang dilakukan `deploy/staging/deploy.sh`

1. Build image `adam-precare/api` & `adam-precare/web` bertag commit (12 karakter SHA).
2. Menyalakan PostgreSQL+PostGIS & Redis, lalu `prisma migrate deploy`.
3. (Opsional, `RUN_SEED=1`) seed data contoh **hanya bila tabel `users` kosong**.
4. Menjalankan api & web, health check `GET /v1/health` dan `GET /login` (maks. 2 menit).
5. Berhasil → tag disimpan di `~/.adam-precare-staging/current_tag`. Gagal → log api/web dicetak dan
   **rollback otomatis** ke tag sebelumnya.

## Rahasia

- Disimpan **hanya di server**: `~/.adam-precare-staging/.env` (permission 600). Template: `deploy/staging/.env.example`.
- Tidak pernah di repo (repo ini publik). CI membangkitkan rahasia acak sendiri untuk test.

## Operasional

```bash
# Deploy manual (di staging)
cd ~/deploy-work/adamprecare && git fetch origin && git checkout -B staging origin/staging
./deploy/staging/deploy.sh

# Rollback manual ke deploy sebelumnya
cd ~/deploy-work/adamprecare/deploy/staging
IMAGE_TAG=$(cat ~/.adam-precare-staging/previous_tag) docker compose --env-file .env up -d --no-build api web

# Log
docker compose -p adam-precare-staging logs -f api
```

## Runner self-hosted (sekali saja)

Agen runner sudah diunduh di `~/actions-runners/adamprecare` (macOS arm64). Pendaftaran membutuhkan token dari
GitHub → repo → **Settings → Actions → Runners → New self-hosted runner** (berlaku 1 jam):

```bash
cd ~/actions-runners/adamprecare
./config.sh --url https://github.com/tulisankode/adamprecare --token <TOKEN> \
  --name mac-mini-staging --labels staging --work _work --unattended --replace
./svc.sh install && ./svc.sh start      # berjalan sebagai layanan launchd user adamlabs
```

Docker Desktop harus aktif di Mac mini agar job deploy berhasil.
