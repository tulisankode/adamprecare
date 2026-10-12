# Brief: Aplikasi Mobile Adam PreCare (Expo React Native)

> **Cara pakai:** tempel seluruh dokumen ini ke emergent.sh dan lampirkan 5 gambar mockup dari folder `docs/mobile/`: `Login.png`, `Home.png`, `Pasien.png`, `Lokasi.png`, `Profile.png`.

---

## 1. Ringkasan

Buat aplikasi mobile **Adam PreCare** — aplikasi permintaan ambulans darurat untuk masyarakat Indonesia. Pengguna dapat:

1. Menekan tombol **SOS**, memilih jenis kasus, mengisi data pasien + lokasi + foto, lalu meminta ambulans.
2. Melihat status dan **melacak ambulans** secara realtime di peta.
3. Mengelola data **pasien** yang pernah dilaporkan.
4. Mencari **fasilitas kesehatan (FASKES)** terdekat dan membuka rute di Google Maps.
5. Membaca **artikel** kesehatan.

Aplikasi yang sama juga punya **mode petugas ambulans** (peran `CREW`) untuk menerima tugas, mengirim lokasi GPS, dan memperbarui status perjalanan.

Bahasa antarmuka: **Bahasa Indonesia**.

---

## 2. Batasan Penting (WAJIB dibaca)

1. **Jangan membuat backend.** Backend (NestJS) sudah dibuat terpisah oleh tim kami. Aplikasi ini hanya klien yang memanggil REST API + Socket.IO sesuai kontrak di §8.
2. Agar aplikasi bisa didemokan tanpa backend, buat **lapisan mock** di dalam aplikasi yang meniru kontrak API secara persis (lihat §9). Mock aktif bila `EXPO_PUBLIC_USE_MOCK=true`.
3. Semua akses API melalui **satu modul klien** (`src/api/`) sehingga beralih dari mock ke backend asli cukup dengan mengubah variabel lingkungan.
4. Ikuti mockup sedekat mungkin (tata letak, warna, tipografi, ikon), kecuali pada poin yang secara eksplisit dikoreksi di §6.
5. Jangan menyimpan API key apa pun di kode. Geocoding dan routing dilakukan lewat backend.

---

## 3. Stack Teknis

| Kebutuhan | Pilihan |
|---|---|
| Framework | **Expo SDK (versi stabil terbaru) + TypeScript (strict)** |
| Navigasi | `expo-router` (file-based) |
| Data server | `@tanstack/react-query` + `axios` |
| State lokal | `zustand` |
| Form & validasi | `react-hook-form` + `zod` |
| Penyimpanan token | `expo-secure-store` |
| Lokasi | `expo-location` (foreground; background hanya untuk mode petugas saat bertugas) |
| Kamera / galeri | `expo-image-picker` + `expo-image-manipulator` (kompres ke lebar maks 1280 px, JPEG 0.7) |
| Peta | `react-native-maps` (provider Google di Android) |
| Realtime | `socket.io-client` |
| Push notification | `expo-notifications` (daftarkan token ke `POST /me/devices`) |
| Login Google | `expo-auth-session` / Google Sign-In → kirim `id_token` ke backend |
| Font | `@expo-google-fonts/poppins` (400, 500, 600) |
| Ikon | `@expo/vector-icons` |

Variabel lingkungan:

```
EXPO_PUBLIC_API_BASE_URL=https://api-precare.adamlabs.dev/v1
EXPO_PUBLIC_SOCKET_URL=https://api-precare.adamlabs.dev
EXPO_PUBLIC_SOCKET_PATH=/realtime
EXPO_PUBLIC_USE_MOCK=true
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
```

Struktur folder yang disarankan:

```
app/                    # expo-router
  (auth)/               # splash, login, register, otp, forgot-password
  (tabs)/               # beranda, pasien, lokasi, profil
  sos/                  # pilih-kasus, data-kasus, status, lacak
  patients/[id].tsx
  facilities/[id].tsx
  articles/  pages/[slug].tsx
  crew/                 # mode petugas
src/
  api/                  # client.ts, endpoints/*.ts, types.ts, mock/*
  realtime/             # socket.ts
  theme/                # tokens.ts (warna, tipografi, spasi)
  components/           # Button, TextField, Card, Chip, StatusBadge, SosButton, ...
  stores/               # auth.ts
  utils/
```

---

## 4. Design System

### 4.1 Warna

| Token | Hex | Pemakaian |
|---|---|---|
| `primary` | `#E95B58` | Tombol utama, SOS, header konfirmasi, ikon & label tab aktif, kartu profil, tanda `*` |
| `primaryPressed` | `#D04643` | State tekan |
| `primarySoft` | `#FDEFEE` | Latar ikon tipe kasus, chip poliklinik, area unggah foto |
| `primaryRing` | `#F8C9C7` | Cincin luar tombol SOS |
| `onPrimary` | `#FFFFFF` | Teks di atas primary |
| `warning` | `#E89F29` | Dialog konfirmasi keluar |
| `warningSoft` | `#FCE0B3` | Cincin tengah ikon peringatan |
| `warningSubtle` | `#FAEDD7` | Cincin luar ikon peringatan |
| `textPrimary` | `#1E1E1E` | Judul & isi |
| `textBody` | `#3F3F3F` | Teks menu |
| `textSecondary` | `#9D9D9D` | Alamat, keterangan, placeholder |
| `iconInactive` | `#B2B9C6` | Tab tidak aktif |
| `border` | `#D0D5DD` | Garis tepi input |
| `divider` | `#E6E8EC` | Pemisah |
| `surface` | `#FFFFFF` | Kartu, input |
| `background` | `#FCFCFC` | Latar layar |
| `success` | `#2E9E5B` | Status selesai/tiba |
| `info` | `#3A7BD5` | Status diterima |
| `danger` | `#D92D20` | Pesan error validasi (beda dari `primary`) |

### 4.2 Tipografi — Poppins

| Token | Ukuran / line height / berat | Contoh |
|---|---|---|
| `display` | 24 / 32 / 600 | "Halo Adam!", "Selamat Datang!" |
| `title` | 18 / 26 / 600 | Judul app bar |
| `subtitle` | 16 / 24 / 600 | "Kecelakaan", nama FASKES di kartu, tombol |
| `body` | 14 / 22 / 400 | Isi input, menu |
| `label` | 13 / 20 / 500 | Label field |
| `caption` | 11 / 16 / 400 | Alamat, label tab |

Hormati skala font sistem, maksimal 1,3×.

### 4.3 Spasi & komponen

- Skala spasi: 4, 8, 12, 16, 20, 24, 32. Padding horizontal layar: 20.
- Radius: chip 6, tombol & input 8, kartu & dialog 12, bottom sheet 24.
- Bayangan kartu halus (`0 2 8 rgba(16,24,40,0.06)`).
- **Tombol primary**: tinggi 48, latar `primary`, teks putih 16/600, ikon opsional di kiri.
- **Tombol outline**: border 1.5 warna primary/warning.
- **Text field**: tinggi 48, label di atas (`*` merah untuk wajib), ikon prefix (cari) / suffix (mata, dropdown), pesan error di bawah berwarna `danger`.
- **Bottom navigation**: 4 tab — Beranda, Pasien, Lokasi, Profil (ikon rumah, orang, pin lokasi, user). Aktif = `primary`, tidak aktif = `iconInactive`.
- **Tombol SOS**: lingkaran `primary` dengan 2 cincin luar transparan + animasi pulse.
- Ukuran sentuh minimum 48 dp.

---

## 5. Layar & Perilaku

Rujukan gambar mockup ditulis di kurung siku.

### 5.1 Splash [Login.png, 11 frame pertama]

- Animasi lingkaran merah membesar memenuhi layar, lalu layar putih dengan logo ADAM PRECARE.
- Selama splash: muat font, cek `GET /app-versions/latest` (jika versi aplikasi < `min_supported_version` → layar "Perbarui Aplikasi"), cek refresh token tersimpan → `POST /auth/refresh` → ke Beranda; jika gagal → Login.

### 5.2 Login [Login.png, frame terakhir]

- Header merah dengan logo, "Selamat Datang!", subjudul "Masukkan Email/No. Telepon dan Password Anda dengan benar."
- Field: **Email/No. Telepon\***, **Password\*** (ikon mata), checkbox **Ingat Saya**, tautan **Lupa Password?**, tombol **Masuk**, teks "Belum memiliki akun? **Buat Akun**", pemisah "Atau", tombol **Akun Google**.
- `POST /auth/login`. Ingat Saya dicentang → simpan refresh token di secure storage; tidak dicentang → simpan di memori saja.
- Jika peran pengguna `CREW` → arahkan ke mode petugas (§5.12).
- Login Google → `POST /auth/google`; jika `profile_incomplete` → layar "Lengkapi Nomor HP" (`POST /me/phone` → OTP → `POST /auth/otp/verify` purpose `VERIFY_PHONE`).

### 5.3 Buat Akun, OTP, Lupa Password (tidak ada di mockup — ikuti gaya Login)

- **Buat Akun**: Nama Lengkap\*, Email\*, No. Telepon\*, Password\* (min 8), Konfirmasi Password\*, checkbox persetujuan "Kebijakan Privasi" & "Syarat dan Ketentuan" (tautan ke `/pages/:slug`). → `POST /auth/register` → layar OTP.
- **OTP**: 6 kotak digit, hitung mundur 60 detik untuk "Kirim ulang" (`POST /auth/otp/send`). → `POST /auth/otp/verify` → token → Beranda. Di mode dev, tampilkan `dev_otp` sebagai petunjuk kecil bila ada.
- **Lupa Password**: input email/HP → OTP (`RESET_PASSWORD`) → password baru → `POST /auth/password/reset` → kembali ke Login dengan pesan sukses.

### 5.4 Beranda [Home.png, frame 1 & 7]

- "Halo" (abu-abu) + "**{nama}!**" (tebal).
- Carousel banner (`GET /banners`) dengan indikator titik; banner default: "Apakah anda dalam keadaan darurat?".
- **Jika tidak ada permintaan aktif** (`GET /emergency-requests/active` = `null`): teks "Tekan tombol di bawah ini, bantuan akan segera datang." + **tombol SOS** → layar Pilih Kasus.
- **Jika ada permintaan aktif**: ganti tombol SOS dengan kartu "**Ambulans Sedang Dalam Perjalanan**" (ikon ambulans + `status_label` + estimasi waktu) → tap ke layar Status.
- Kartu **Lokasi Anda Saat Ini**: ikon pin merah + alamat dari `GET /geocode/reverse` dengan lokasi perangkat. Jika izin lokasi ditolak, tampilkan tombol "Aktifkan Lokasi".
- Seksi **Artikel** + tautan "Lainnya" → Daftar Artikel. Kartu artikel: gambar dengan judul putih di atas gradasi gelap, scroll horizontal.
- Tambahkan tombol kecil **"Panggil 119"** (tel:119) di bawah tombol SOS sebagai fallback darurat.

### 5.5 Pilih Kasus [Home.png, frame 2]

- App bar "SOS" dengan tombol kembali. Judul "Silahkan, pilih tipe Kasus".
- Daftar kartu dari `GET /case-types`: ikon dalam kotak `primary` + nama (Kecelakaan, Nyeri Dada, Sesak Nafas, Bencana Alam, Lainnya).
- Tap → Data Kasus dengan tipe terpilih.

### 5.6 Data Kasus [Home.png, frame 3 + bottom sheet Camera/Gallery]

- App bar "Data Kasus". Judul = nama tipe kasus (mis. "Kecelakaan").
- Jika tipe `LAINNYA`: field tambahan **Jenis Kasus\*** (teks bebas, maks 100).
- **Identitas\*** (NIK/nomor identitas) + checkbox kecil "Tidak diketahui".
- Tombol **Data Diri Sendiri** (ikon orang) → isi identitas & nama dari profil, kirim `patient.use_self = true`. Jika profil belum punya NIK, minta lengkapi profil.
- **Nama Pasien\*** + checkbox "Tidak diketahui".
- **Lokasi\***: field dengan ikon cari (pencarian alamat via `GET /geocode/search`, tampilkan hasil dalam dropdown). Tombol **Pilih Lokasi Saat Ini** (ikon crosshair) → GPS + reverse geocode. Koordinat wajib ada.
- **Deskripsi\*** (multiline, maks 1000).
- **Foto** (opsional, maks 3): area dashed `primarySoft` "Ketuk untuk ambil/unggah foto" → bottom sheet **Camera / Gallery**. Tampilkan thumbnail dengan tombol hapus.
- Tombol **Simpan** (sticky di bawah).
- Alur kirim: buat `client_request_id` (UUID) → `POST /emergency-requests` → segera navigasi ke layar Status → unggah foto satu per satu di latar belakang (`POST /emergency-requests/:id/photos`). Kegagalan unggah foto tidak boleh membatalkan permintaan; tampilkan opsi coba lagi.
- Retry otomatis dengan `client_request_id` yang sama bila jaringan putus.
- Error `PHONE_NOT_VERIFIED` → arahkan verifikasi HP. `ACTIVE_REQUEST_EXISTS` → arahkan ke layar Status permintaan aktif.

### 5.7 Status Permintaan [Home.png, frame 5]

- Layar penuh merah, ilustrasi ambulans, judul = `status_label` dari server (**jangan** hardcode "sedang dalam perjalanan"), kutipan "*Bicaralah dengan tenang kepada korban/pasien hingga petugas pertolongan pertama tiba.*"
- Tombol putih **Lacak Ambulans** (aktif bila `ambulance` ≠ null) dan tautan **Batalkan Permintaan** (tampil bila `can_cancel`).
- Batalkan → dialog konfirmasi dengan pilihan alasan (Sudah ditangani / Salah input / Ambulans terlalu lama / Lainnya + teks) → `POST /emergency-requests/:id/cancel`.
- Saat status `MENUNGGU`, tampilkan animasi "mencari".
- Status `TIDAK_TERLAYANI` → tombol besar **Panggil 119**.
- Status `SELESAI`/`DIBATALKAN` → tombol "Kembali ke Beranda".
- Update via Socket.IO (`request.updated`), fallback polling `GET /emergency-requests/:id` tiap 10 detik.

### 5.8 Lacak Ambulans [Home.png, frame 6]

- App bar "Lacak Ambulans". Kartu atas: "Ambulans dan petugas sedang dalam perjalanan" + kutipan kecil.
- Peta penuh: marker lokasi kejadian (pin merah), marker ambulans (ikon ambulans, diputar sesuai `heading`), garis rute merah dari ambulans ke lokasi.
- Kartu bawah: ikon palang merah + **nama penyedia** (`provider.name`, mis. "RS SEHAT SENTOSA" atau "PSC 119 Kota Surabaya") + "Estimasi waktu tiba ({n} menit)" dari `eta_seconds`, nama & plat ambulans.
- Tombol **Telpon** (`tel:` ke `provider.phone`) dan **Batalkan** (outline).
- Posisi dari event `ambulance.location` (Socket.IO room `request:{id}`), animasi marker halus.

### 5.9 Pasien [Pasien.png]

- **List Pasien** (judul "Daftar Pasien"): kartu berisi ikon orang, nama, ikon KTP + nomor identitas (merah), pemisah, ikon umur + `age_text`, ikon gender + "Laki-laki"/"Perempuan"/"-". Pull-to-refresh, infinite scroll. State kosong: "Belum ada data pasien".
- **Data Pasien** (detail/ubah): judul = tipe kasus terakhir (`last_case.case_type.name`), field Identitas\*, Nama Pasien\*, **Umur\***, **Jenis Kelamin\*** (dropdown Laki-laki/Perempuan), Lokasi (read-only dari kasus terakhir), Deskripsi (read-only), Foto (read-only dari kasus terakhir). Tombol **Simpan** → `PATCH /patients/:id`.
- Kartu tanpa umur/jenis kelamin menampilkan "- Tahun" dan "-" (ini normal: data dilengkapi belakangan).

### 5.10 Lokasi FASKES [Lokasi.png]

- **Daftar**: judul "Lokasi FASKES", kartu dengan foto lebar, nama, alamat (abu-abu kecil), ikon pin + jarak "{n} KM", ikon telepon + nomor (tap = panggil). Data `GET /facilities?lat=&lng=`. Kolom pencarian di atas daftar.
- **Detail**: foto header dengan tombol tutup bulat, kartu putih bersudut atas 24: nama, jarak & telepon, alamat, pemisah, "Poli Klinik" + chip `primarySoft`, tombol **Google Maps** (ikon peta) → buka `maps_url`.

### 5.11 Profil [Profile.png]

- Judul "Profil". Kartu merah: avatar bulat putih, nama, nomor identitas/HP.
- Menu (ikon merah + teks, pemisah tipis): Edit Profil, Ubah Password, FAQ, Kebijakan Privasi, Syarat dan Ketentuan, Info Update, **Keluar** (teks merah).
- **Edit Profil**: Nama, NIK, Tanggal Lahir (date picker), Jenis Kelamin, Email (read-only), No. HP (read-only). → `PATCH /me`.
- **Ubah Password**: Password Lama (sembunyikan bila `has_password` = false, judul jadi "Buat Password"), Password Baru, Konfirmasi. → `POST /me/password`.
- **FAQ / Kebijakan Privasi / Syarat dan Ketentuan**: satu template, render `body_html` dari `GET /pages/:slug`.
- **Info Update**: versi aplikasi terpasang + `release_notes` dari `GET /app-versions/latest`.
- **Keluar**: dialog dengan ikon peringatan oranye (3 lingkaran konsentris), teks "Apakah Anda yakin ingin keluar?", tombol **Tidak** (isi oranye) dan **Ya** (outline oranye). Ya → `POST /auth/logout`, hapus token, ke Login.

### 5.12 Mode Petugas (peran `CREW`; tidak ada di mockup — pakai design system yang sama)

- Bottom navigation: **Tugas**, **Profil**.
- **Tugas**: toggle besar "Mulai Jaga / Akhiri Jaga" (`PATCH /crew/duty`), info ambulans (nama, plat). Jika ada tugas aktif (`GET /crew/assignments/active`, event `assignment.created`): kartu tugas dengan tipe kasus, nama pasien, alamat, deskripsi, foto, tombol telepon pelapor, peta ke lokasi kejadian, dan **satu tombol aksi besar** sesuai status:
  - `DITERIMA` → "Berangkat" (`DALAM_PERJALANAN`)
  - `DALAM_PERJALANAN` → "Tiba di Lokasi" (`TIBA`)
  - `TIBA` → "Bawa ke FASKES" (pilih FASKES tujuan dari `GET /facilities` → `MENUJU_FASKES`) atau "Selesai di Tempat" (`SELESAI`)
  - `MENUJU_FASKES` → "Sampai di RS" (`SAMPAI_DI_FASKES`)
  - `SAMPAI_DI_FASKES` → "Pasien Diperiksa / Selesai" (`SELESAI`)
- Selama `on_duty` dan ada tugas aktif: kirim lokasi `POST /crew/location` tiap 5 detik (pakai background location dengan notifikasi foreground di Android).
- Getar + suara saat tugas baru masuk.

### 5.13 Halaman umum lain

- Daftar & detail artikel (`GET /articles`, `GET /articles/:slug`).
- Riwayat permintaan SOS (dari Profil → "Riwayat Permintaan", `GET /emergency-requests`).
- Layar izin lokasi/kamera/notifikasi dengan penjelasan sebelum meminta izin.
- State kosong, loading (skeleton), error dengan tombol "Coba Lagi", banner offline.

---

## 6. Koreksi terhadap Mockup (ikuti ini, bukan mockup)

1. Gunakan kata **"Ambulans"** di semua teks (bukan Ambulan/Ambulance).
2. "List Pasient" → **"Daftar Pasien"**.
3. "Top untuk foto/upload gambar" → **"Ketuk untuk ambil/unggah foto"**.
4. Judul layar status diambil dari `status_label` server, bukan teks tetap.
5. Tambahkan opsi **"Tidak diketahui"** untuk Identitas dan Nama Pasien (korban yang tidak dikenal).
6. Tambahkan tombol **"Panggil 119"** di Beranda dan di status `TIDAK_TERLAYANI`.
7. Abaikan teks samar/skeleton yang tertinggal di belakang mockup List Pasien.
8. Peta di mockup (Brooklyn) hanya contoh; gunakan lokasi nyata.

---

## 7. Aturan Teknis Klien

- **Token**: access token di memori; refresh token di secure storage (bila Ingat Saya). Interceptor axios: saat `401 UNAUTHENTICATED`, panggil `/auth/refresh` sekali (antrikan request paralel), ulangi request; jika gagal → logout.
- **Error**: tampilkan `error.message` dari server; untuk `VALIDATION_ERROR`, tampilkan `details[].message` di bawah field terkait.
- **Nomor HP**: terima `08…`/`628…`/`+628…`.
- **Tanggal** ditampilkan dalam format Indonesia (`10 Okt 2026, 09:00`), zona waktu perangkat.
- **Aksesibilitas**: label aksesibilitas pada semua tombol ikon; kontras sesuai WCAG AA.
- **Tipe TypeScript** untuk semua objek API di `src/api/types.ts`, sesuai §8.

---

## 8. Kontrak API (ringkas — untuk aplikasi mobile)

Base URL `EXPO_PUBLIC_API_BASE_URL` — staging: `https://api-precare.adamlabs.dev/v1` (akun uji: pengguna `demo@adamprecare.id` / `password123`, petugas `petugas01` / `password123`). JSON `snake_case`. Header `Authorization: Bearer <access_token>`.

**Respons**: sukses `{ "data": ... }`, dengan pagination `{ "data": [...], "meta": { "page", "per_page", "total", "total_pages" } }`, gagal `{ "error": { "code", "message", "details"? } }`.

**Kode error**: `VALIDATION_ERROR` (400), `UNAUTHENTICATED` / `INVALID_CREDENTIALS` (401), `FORBIDDEN` / `PHONE_NOT_VERIFIED` (403), `NOT_FOUND` (404), `ACTIVE_REQUEST_EXISTS` / `INVALID_STATUS_TRANSITION` / `DUPLICATE` (409), `OTP_INVALID` (422), `RATE_LIMITED` (429).

### 8.1 Objek

```ts
type Role = 'USER' | 'CREW' | 'FACILITY_OPERATOR' | 'FACILITY_ADMIN' | 'SUPER_ADMIN';
type Gender = 'L' | 'P';
type RequestStatus = 'MENUNGGU' | 'DITERIMA' | 'DALAM_PERJALANAN' | 'TIBA' | 'MENUJU_FASKES'
  | 'SAMPAI_DI_FASKES' | 'SELESAI' | 'DIBATALKAN' | 'TIDAK_TERLAYANI';

interface AuthTokens { access_token: string; refresh_token: string; expires_in: number; user: User; profile_incomplete?: boolean }

interface User {
  id: string; role: Role; name: string; username: string | null; email: string | null;
  phone: string | null; phone_verified: boolean; nik_masked: string | null;
  birth_date: string | null; gender: Gender | null; avatar_url: string | null; has_password: boolean;
  facility: { id: string; name: string; type: string } | null;
}

interface CaseType { code: 'KECELAKAAN' | 'NYERI_DADA' | 'SESAK_NAFAS' | 'BENCANA_ALAM' | 'LAINNYA';
  name: string; icon: string; color: string; priority: 'TINGGI' | 'NORMAL' }

interface Photo { id: string; url: string }   // URL bertanda tangan, berlaku 5 menit

interface Patient {
  id: string; is_self: boolean; name: string | null; name_unknown: boolean;
  identity_number: string | null; identity_unknown: boolean;
  age_years: number | null; birth_date: string | null; age_text: string; gender: Gender | null;
  created_at: string; updated_at: string;
  last_case?: { request_id: string; case_type: CaseType; description: string; address: string; photos: Photo[]; requested_at: string } | null;
}

interface EmergencyRequest {
  id: string; code: string; status: RequestStatus; status_label: string; status_badge: string;
  case_type: CaseType; case_type_other: string | null;
  patient: { id: string; name: string | null; identity_number_masked: string | null; age_text: string; gender: Gender | null };
  location: { lat: number; lng: number; address: string };
  description: string; photos: Photo[];
  provider: { id: string; name: string; type: string; phone: string } | null;
  destination: { id: string; name: string } | null;
  ambulance: { id: string; name: string; plate_number: string; type: string;
    location: { lat: number; lng: number; heading: number | null; updated_at: string } | null } | null;
  eta_seconds: number | null;
  timeline: { status: RequestStatus; label: string; at: string }[];
  can_cancel: boolean; requested_at: string; updated_at: string;
  // hanya untuk petugas (endpoint /crew/*):
  reporter_phone?: string | null;
  reporter_name?: string;
  // patient.identity_number (string | null) juga ikut dikirim untuk petugas
}

interface Facility {
  id: string; name: string; type: 'RUMAH_SAKIT' | 'KLINIK' | 'PUSKESMAS' | 'PSC_119';
  address: string; phone: string; photo_url: string | null; location: { lat: number; lng: number };
  distance_km: number | null; polyclinics: string[]; maps_url: string;
}
```

### 8.2 Endpoint

| Method | Path | Body / Query | `data` |
|---|---|---|---|
| POST | `/auth/register` | `{ name, email, phone, password }` | `{ user, otp_sent_to, dev_otp? }` |
| POST | `/auth/otp/send` | `{ target, purpose: 'REGISTER'\|'RESET_PASSWORD'\|'VERIFY_PHONE' }` | `{ otp_sent_to, dev_otp? }` |
| POST | `/auth/otp/verify` | `{ target, purpose, code }` | `AuthTokens` atau `{ reset_token }` (RESET_PASSWORD) |
| POST | `/auth/login` | `{ identifier, password }` | `AuthTokens` |
| POST | `/auth/google` | `{ id_token }` | `AuthTokens` |
| POST | `/auth/refresh` | `{ refresh_token }` | `AuthTokens` |
| POST | `/auth/password/reset` | `{ reset_token, new_password }` | `{ success }` |
| POST | `/auth/logout` | `{ refresh_token }` | `{ success }` |
| GET | `/me` | – | `User` |
| PATCH | `/me` | `{ name?, nik?, birth_date?, gender?, avatar_url? }` | `User` |
| POST | `/me/password` | `{ current_password?, new_password }` | `{ success }` |
| POST | `/me/phone` | `{ phone }` | `{ otp_sent_to, dev_otp? }` |
| POST | `/me/devices` | `{ fcm_token, platform }` | `{ success }` |
| GET | `/banners` | – | `{ id, title, image_url, action_url }[]` |
| GET | `/articles` | `page, per_page` | `{ id, slug, title, cover_url, excerpt, published_at }[]` + meta |
| GET | `/articles/:slug` | – | `{ id, slug, title, cover_url, body_html, published_at }` |
| GET | `/case-types` | – | `CaseType[]` |
| GET | `/geocode/reverse` | `lat, lng` | `{ address }` |
| GET | `/geocode/search` | `q` | `{ address, lat, lng }[]` |
| GET | `/pages/:slug` | – | `{ slug, title, body_html, updated_at }` |
| GET | `/app-versions/latest` | `platform` | `{ version, min_supported_version, release_notes, released_at }` |
| POST | `/emergency-requests` | lihat bawah | `EmergencyRequest` |
| POST | `/emergency-requests/:id/photos` | multipart `photo` | `Photo` |
| GET | `/emergency-requests/active` | – | `EmergencyRequest \| null` |
| GET | `/emergency-requests/:id` | – | `EmergencyRequest` |
| GET | `/emergency-requests` | `page, per_page` | `EmergencyRequest[]` + meta |
| POST | `/emergency-requests/:id/cancel` | `{ reason }` | `EmergencyRequest` |
| GET | `/patients` | `page, per_page` | `Patient[]` + meta |
| POST | `/patients` | `{ name, identity_number?, age_years?, birth_date?, gender? }` | `Patient` |
| GET | `/patients/:id` | – | `Patient` (dengan `last_case`) |
| PATCH | `/patients/:id` | field sama dengan POST | `Patient` |
| DELETE | `/patients/:id` | – | `{ success }` |
| GET | `/facilities` | `lat, lng, q, page, per_page` | `Facility[]` + meta |
| GET | `/facilities/:id` | `lat, lng` | `Facility` |
| GET | `/crew/me` | – | `{ on_duty, ambulance, facility }` |
| PATCH | `/crew/duty` | `{ on_duty }` | sama seperti `/crew/me` |
| GET | `/crew/assignments/active` | – | `EmergencyRequest \| null` |
| POST | `/crew/assignments/:id/status` | `{ status, destination_facility_id? }` | `EmergencyRequest` |
| POST | `/crew/location` | `{ lat, lng, heading?, speed?, recorded_at? }` | `{ success }` |

Body `POST /emergency-requests`:

```json
{
  "client_request_id": "uuid-v4-dari-klien",
  "case_type_code": "KECELAKAAN",
  "case_type_other": null,
  "patient": { "use_self": false, "patient_id": null, "name": "Adam", "name_unknown": false,
               "identity_number": "1234567890", "identity_unknown": false },
  "location": { "lat": -7.2797, "lng": 112.7975, "address": "Eastern Park AB, Surabaya" },
  "description": "Tabrakan motor"
}
```

### 8.3 Realtime (Socket.IO)

- `io(EXPO_PUBLIC_SOCKET_URL, { path: EXPO_PUBLIC_SOCKET_PATH, auth: { token: accessToken } })`
- Klien emit `subscribe` `{ request_id }` / `unsubscribe` `{ request_id }`.
- Event: `request.updated` (`EmergencyRequest`), `ambulance.location` (`{ request_id, lat, lng, heading, eta_seconds, updated_at }`), `assignment.created` (`EmergencyRequest`, untuk petugas).
- Reconnect otomatis; saat putus, polling endpoint detail tiap 10 detik.

---

## 9. Mode Mock (`EXPO_PUBLIC_USE_MOCK=true`)

Implementasikan di `src/api/mock/` dengan bentuk respons **identik** dengan §8:

- Akun demo: pengguna `demo@adamprecare.id` / `password123` (nama "Adam") dan petugas `petugas01` / `password123`. OTP mock selalu `123456`.
- Data contoh: 5 tipe kasus, 3 banner, 5 artikel, 6 FASKES di sekitar Surabaya & Magelang (termasuk "Klinik Pratama Dawuhan", "RS Sehat Sentosa"), 2 pasien.
- **Simulasi SOS**: setelah permintaan dibuat, status berubah otomatis `MENUNGGU` → (5 dtk) `DITERIMA` (penyedia "RS Sehat Sentosa", ambulans "Ambulan 001", "L 1234 XYZ") → (5 dtk) `DALAM_PERJALANAN` — ambulans bergerak mendekati lokasi kejadian tiap 2 detik dengan `eta_seconds` berkurang → `TIBA` setelah ±60 detik. Emit event yang sama seperti Socket.IO melalui event emitter lokal.
- Latensi buatan 300–600 ms.

---

## 10. Kriteria Selesai

- [ ] Semua layar §5 berjalan di Android & iOS (Expo Go / development build), tampilan sesuai mockup dan design system §4.
- [ ] Mode mock berjalan penuh: login, SOS sampai status `TIBA` dengan ambulans bergerak di peta, pasien, FASKES, profil, logout.
- [ ] Mengganti `EXPO_PUBLIC_USE_MOCK=false` dan `EXPO_PUBLIC_API_BASE_URL` ke backend nyata tidak memerlukan perubahan kode.
- [ ] Mode petugas: jaga, terima tugas, ubah status, kirim lokasi.
- [ ] Validasi form sesuai §5 dengan pesan Bahasa Indonesia.
- [ ] Refresh token otomatis & logout bila refresh gagal.
- [ ] Tidak ada API key atau rahasia di kode.
- [ ] README berisi cara menjalankan, daftar variabel lingkungan, dan struktur folder.
