# Kontrak API — Adam PreCare v1

Sumber kebenaran bersama untuk **API (NestJS)**, **dashboard web (Next.js)**, dan **aplikasi mobile (Expo)**. Setiap perubahan endpoint wajib memperbarui dokumen ini terlebih dahulu. Rancangan sistem lengkap ada di [desain_system.md](desain_system.md).

---

## 1. Konvensi Umum

| Aspek | Aturan |
|---|---|
| Base URL | `{API_BASE_URL}/v1` — dev: `http://localhost:4000/v1` |
| Format | JSON, `Content-Type: application/json` (kecuali upload: `multipart/form-data`) |
| Penamaan field | `snake_case` |
| Autentikasi | `Authorization: Bearer <access_token>` |
| Waktu | ISO 8601 UTC, mis. `2026-10-12T02:15:00.000Z`. Filter tanggal `from`/`to` memakai `YYYY-MM-DD` dan ditafsirkan di zona **Asia/Jakarta**, inklusif. |
| Koordinat | `lat`, `lng` dalam derajat desimal (WGS84) |
| Pagination | Query `page` (mulai 1) & `per_page` (default 10, maks 100) |
| Idempotensi | `POST /emergency-requests` wajib mengirim `client_request_id` (UUID dari klien). Pengiriman ulang dengan ID sama mengembalikan permintaan yang sama. |

### 1.1 Format respons

Sukses:

```json
{ "data": { } }
```

Sukses dengan pagination:

```json
{ "data": [ ], "meta": { "page": 1, "per_page": 10, "total": 57, "total_pages": 6 } }
```

Gagal:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Data tidak valid.", "details": [ { "field": "phone", "message": "Format nomor HP tidak valid." } ] } }
```

### 1.2 Kode error

| HTTP | `code` | Arti |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Input tidak valid (`details` berisi per field) |
| 401 | `UNAUTHENTICATED` | Token tidak ada / kedaluwarsa → klien memanggil `/auth/refresh` |
| 401 | `INVALID_CREDENTIALS` | Login gagal |
| 403 | `FORBIDDEN` | Peran tidak berhak |
| 403 | `PHONE_NOT_VERIFIED` | Harus verifikasi nomor HP sebelum mengirim SOS |
| 404 | `NOT_FOUND` | Data tidak ditemukan |
| 409 | `ACTIVE_REQUEST_EXISTS` | Pengguna masih punya permintaan SOS aktif |
| 409 | `ALREADY_TAKEN` | Kasus sudah diterima penyedia lain |
| 409 | `INVALID_STATUS_TRANSITION` | Perubahan status tidak diizinkan |
| 409 | `DUPLICATE` | Data unik sudah ada (email, HP, username, No. RM) |
| 422 | `OTP_INVALID` | Kode OTP salah / kedaluwarsa |
| 429 | `RATE_LIMITED` | Terlalu banyak permintaan |
| 500 | `INTERNAL_ERROR` | Kesalahan server |

### 1.3 Enum

| Enum | Nilai |
|---|---|
| `role` | `USER`, `CREW`, `FACILITY_OPERATOR`, `FACILITY_ADMIN`, `SUPER_ADMIN` |
| `gender` | `L`, `P` |
| `case_type.code` | `KECELAKAAN`, `NYERI_DADA`, `SESAK_NAFAS`, `BENCANA_ALAM`, `LAINNYA` |
| `request.status` | `MENUNGGU`, `DITERIMA`, `DALAM_PERJALANAN`, `TIBA`, `MENUJU_FASKES`, `SAMPAI_DI_FASKES`, `SELESAI`, `DIBATALKAN`, `TIDAK_TERLAYANI` |
| `facility.type` | `RUMAH_SAKIT`, `KLINIK`, `PUSKESMAS`, `PSC_119` |
| `ambulance.type` | `PASIEN`, `GAWAT_DARURAT`, `JENAZAH` |
| `ambulance.status` | `TERSEDIA`, `BERTUGAS`, `NONAKTIF` |
| `medical_record_source` | `MANUAL`, `SIMRS` |
| `simrs_status` | `NOT_CONFIGURED`, `PENDING`, `FOUND`, `NOT_FOUND`, `NO_IDENTITY`, `ERROR` |

**Label status** (dikirim server di field `status_label`, klien tidak perlu memetakan sendiri):

| Status | `status_label` (mobile) | `status_badge` (web) |
|---|---|---|
| MENUNGGU | Mencari ambulans terdekat… | PANGGILAN |
| DITERIMA | Ambulans dari {penyedia} sedang disiapkan | DIPROSES |
| DALAM_PERJALANAN | Ambulans dan petugas sedang dalam perjalanan | DALAM PERJALANAN |
| TIBA | Ambulans telah tiba di lokasi | TIBA DI LOKASI |
| MENUJU_FASKES | Pasien sedang dibawa ke {faskes tujuan} | MENUJU RS |
| SAMPAI_DI_FASKES | Pasien telah tiba di {faskes tujuan} | SAMPAI DI RS |
| SELESAI | Permintaan selesai | DIPERIKSA |
| DIBATALKAN | Permintaan dibatalkan | DIBATALKAN |
| TIDAK_TERLAYANI | Belum ada ambulans tersedia. Hubungi 119. | TIDAK TERLAYANI |

---

## 2. Objek Bersama

### 2.1 `AuthTokens`

```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "b1c2...opaque",
  "expires_in": 900,
  "user": { "$ref": "User" }
}
```

### 2.2 `User`

```json
{
  "id": "0192...", "role": "USER", "name": "Adam", "username": null,
  "email": "adam@example.com", "phone": "+6281234567890", "phone_verified": true,
  "nik_masked": "3578********0001", "birth_date": "2005-04-01", "gender": "L",
  "avatar_url": null, "has_password": true,
  "facility": null
}
```

Untuk staf, `facility` berisi `{ "id", "name", "type" }`.

### 2.3 `CaseType`

```json
{ "code": "KECELAKAAN", "name": "Kecelakaan", "icon": "car-crash", "color": "#4A9FE8", "priority": "TINGGI" }
```

### 2.4 `Patient`

```json
{
  "id": "0192...", "is_self": false, "name": "Adam", "name_unknown": false,
  "identity_number": "1234567890", "identity_unknown": false,
  "age_years": 20, "birth_date": null, "age_text": "20 Th", "gender": "L",
  "created_at": "...", "updated_at": "...",
  "last_case": { "request_id": "...", "case_type": { "$ref": "CaseType" }, "description": "Tabrakan", "address": "Surabaya", "photos": [ { "id": "...", "url": "..." } ], "requested_at": "..." }
}
```

`age_text`: "20Th 3Bln 5Hr" bila `birth_date` ada, "20 Th" bila hanya `age_years`, "-" bila kosong. `last_case` hanya ada di detail.

### 2.5 `EmergencyRequest`

```json
{
  "id": "0192...", "code": "SOS-20261012-0042",
  "status": "DALAM_PERJALANAN", "status_label": "Ambulans dan petugas sedang dalam perjalanan", "status_badge": "DALAM PERJALANAN",
  "case_type": { "$ref": "CaseType" }, "case_type_other": null,
  "patient": { "id": "...", "name": "Adam", "identity_number_masked": "1234****90", "age_text": "20 Th", "gender": "L" },
  "location": { "lat": -7.2797, "lng": 112.7975, "address": "Eastern Park AB, ... Surabaya" },
  "description": "Tabrakan motor",
  "photos": [ { "id": "...", "url": "https://.../files/...?...signature" } ],
  "provider": { "id": "...", "name": "RS Sehat Sentosa", "type": "RUMAH_SAKIT", "phone": "+62315550000" },
  "destination": { "id": "...", "name": "RS Sehat Sentosa" },
  "ambulance": { "id": "...", "name": "Ambulan 001", "plate_number": "L 1234 XYZ", "type": "PASIEN",
                 "location": { "lat": -7.28, "lng": 112.79, "heading": 90, "updated_at": "..." } },
  "eta_seconds": 300,
  "timeline": [ { "status": "MENUNGGU", "label": "Panggil", "at": "..." }, { "status": "DITERIMA", "label": "Diproses", "at": "..." } ],
  "can_cancel": true,
  "requested_at": "...", "updated_at": "..."
}
```

`provider`, `destination`, `ambulance`, `eta_seconds` bernilai `null` bila belum ada.

### 2.6 `Facility`

```json
{
  "id": "...", "name": "Klinik Pratama Dawuhan", "type": "KLINIK",
  "address": "Jl. Magelang - Yogyakarta No.Km.5, ...", "phone": "+622933202654",
  "photo_url": "https://...", "location": { "lat": -7.53, "lng": 110.22 },
  "distance_km": 2.31,
  "polyclinics": [ "Poli Umum", "Poli THT" ],
  "maps_url": "https://www.google.com/maps/dir/?api=1&destination=-7.53,110.22"
}
```

---

## 3. Endpoint Aplikasi Mobile (peran `USER`)

### 3.1 Autentikasi

| Method | Path | Body | Respons `data` |
|---|---|---|---|
| POST | `/auth/register` | `{ name, email, phone, password }` | `{ user, otp_sent_to: "+62812****890", dev_otp? }` — OTP dikirim ke HP |
| POST | `/auth/otp/send` | `{ target, purpose }` — `purpose`: `REGISTER`, `RESET_PASSWORD`, `VERIFY_PHONE` | `{ otp_sent_to, dev_otp? }` |
| POST | `/auth/otp/verify` | `{ target, purpose, code }` | `REGISTER`/`VERIFY_PHONE` → `AuthTokens`; `RESET_PASSWORD` → `{ reset_token }` |
| POST | `/auth/login` | `{ identifier, password }` — `identifier` = email **atau** nomor HP | `AuthTokens` |
| POST | `/auth/google` | `{ id_token }` | `AuthTokens` + `{ profile_incomplete: true }` bila belum ada nomor HP terverifikasi |
| POST | `/auth/refresh` | `{ refresh_token }` | `AuthTokens` (refresh token dirotasi) |
| POST | `/auth/password/reset` | `{ reset_token, new_password }` | `{ success: true }` |
| POST | `/auth/logout` | `{ refresh_token }` | `{ success: true }` |

- `dev_otp` hanya muncul bila server berjalan di mode development.
- Password minimal 8 karakter. Nomor HP diterima dalam format `08…`, `628…`, atau `+628…`, disimpan sebagai `+628…`.
- "Ingat Saya" ditangani klien: simpan `refresh_token` di secure storage hanya jika dicentang.

### 3.2 Profil

| Method | Path | Body | Respons `data` |
|---|---|---|---|
| GET | `/me` | – | `User` |
| PATCH | `/me` | `{ name?, nik?, birth_date?, gender?, avatar_url? }` | `User` |
| POST | `/me/password` | `{ current_password?, new_password }` (`current_password` wajib bila `has_password`) | `{ success: true }` |
| POST | `/me/phone` | `{ phone }` → kirim OTP `VERIFY_PHONE` (untuk akun Google) | `{ otp_sent_to, dev_otp? }` |
| POST | `/me/devices` | `{ fcm_token, platform: "android"\|"ios" }` | `{ success: true }` |

### 3.3 Beranda & konten

| Method | Path | Respons `data` |
|---|---|---|
| GET | `/banners` | `[ { id, title, image_url, action_url } ]` |
| GET | `/articles?page=&per_page=` | `[ { id, slug, title, cover_url, excerpt, published_at } ]` + `meta` |
| GET | `/articles/:slug` | `{ id, slug, title, cover_url, body_html, published_at }` |
| GET | `/case-types` | `[ CaseType ]` |
| GET | `/geocode/reverse?lat=&lng=` | `{ address }` |
| GET | `/geocode/search?q=` | `[ { address, lat, lng } ]` |
| GET | `/pages/:slug` — `faq`, `kebijakan-privasi`, `syarat-ketentuan` | `{ slug, title, body_html, updated_at }` |
| GET | `/app-versions/latest?platform=android\|ios` | `{ version, min_supported_version, release_notes, released_at }` |

### 3.4 SOS / permintaan ambulans

| Method | Path | Body / Query | Respons `data` |
|---|---|---|---|
| POST | `/emergency-requests` | lihat di bawah | `EmergencyRequest` (201) |
| POST | `/emergency-requests/:id/photos` | multipart, field `photo` (jpeg/png/webp, ≤ 5 MB, maks 3 foto) | `{ id, url }` |
| GET | `/emergency-requests/active` | – | `EmergencyRequest` atau `null` |
| GET | `/emergency-requests/:id` | – | `EmergencyRequest` |
| GET | `/emergency-requests?page=&per_page=` | – | `[ EmergencyRequest ]` + `meta` (riwayat) |
| POST | `/emergency-requests/:id/cancel` | `{ reason }` (wajib bila status ≠ `MENUNGGU`) | `EmergencyRequest` |

Body `POST /emergency-requests`:

```json
{
  "client_request_id": "6f1c4f0e-1a2b-4c3d-9e8f-0a1b2c3d4e5f",
  "case_type_code": "KECELAKAAN",
  "case_type_other": null,
  "patient": {
    "use_self": false,
    "patient_id": null,
    "name": "Adam",
    "name_unknown": false,
    "identity_number": "1234567890",
    "identity_unknown": false
  },
  "location": { "lat": -7.2797, "lng": 112.7975, "address": "Eastern Park AB, Surabaya" },
  "description": "Tabrakan motor, korban tidak sadar"
}
```

- `use_self: true` = tombol "Data Diri Sendiri" — server memakai data profil pengguna; field nama/identitas diabaikan.
- `patient_id` diisi bila memilih pasien yang sudah ada.
- `case_type_other` wajib (maks. 100 karakter) bila `case_type_code` = `LAINNYA`.
- Error khusus: `PHONE_NOT_VERIFIED`, `ACTIVE_REQUEST_EXISTS`.

### 3.5 Pasien

| Method | Path | Body | Respons `data` |
|---|---|---|---|
| GET | `/patients?page=&per_page=` | – | `[ Patient ]` + `meta` |
| POST | `/patients` | `{ name, identity_number?, age_years?, birth_date?, gender? }` | `Patient` |
| GET | `/patients/:id` | – | `Patient` (dengan `last_case`) |
| PATCH | `/patients/:id` | `{ name?, identity_number?, age_years?, birth_date?, gender? }` | `Patient` |
| DELETE | `/patients/:id` | – | `{ success: true }` (ditolak `409` bila punya permintaan aktif) |

### 3.6 Lokasi FASKES

| Method | Path | Respons `data` |
|---|---|---|
| GET | `/facilities?lat=&lng=&q=&page=&per_page=` | `[ Facility ]` + `meta`, diurutkan jarak terdekat. Tanpa `lat/lng` → urut nama, `distance_km: null`. |
| GET | `/facilities/:id?lat=&lng=` | `Facility` |

---

## 4. Endpoint Petugas Ambulans (peran `CREW`, aplikasi mobile mode petugas)

| Method | Path | Body | Respons `data` |
|---|---|---|---|
| GET | `/crew/me` | – | `{ on_duty, ambulance: { id, name, plate_number, type, status }, facility: { id, name } }` |
| PATCH | `/crew/duty` | `{ on_duty: boolean }` | sama seperti `/crew/me` |
| GET | `/crew/assignments/active` | – | `EmergencyRequest` + `patient.identity_number`, `reporter_name`, `reporter_phone`, atau `null` |
| POST | `/crew/assignments/:id/status` | `{ status, destination_facility_id? }` — `status` ∈ `DALAM_PERJALANAN`, `TIBA`, `MENUJU_FASKES` (wajib `destination_facility_id`), `SAMPAI_DI_FASKES`, `SELESAI` | `EmergencyRequest` |
| POST | `/crew/location` | `{ lat, lng, heading?, speed?, recorded_at? }` — kirim tiap 5 detik selama bertugas | `{ success: true }` |

Petugas login memakai `POST /auth/login` dengan `identifier` = username/email/HP petugas.

---

## 5. Endpoint Dashboard Web (peran `FACILITY_OPERATOR`, `FACILITY_ADMIN`, `SUPER_ADMIN`)

Semua path `/operator/*` otomatis dibatasi ke penyedia milik staf. `SUPER_ADMIN` boleh mengirim `facility_id` (atau tidak mengirimnya = semua penyedia).

### 5.1 Login & profil

| Method | Path | Body | Respons `data` |
|---|---|---|---|
| POST | `/auth/staff/login` | `{ username, password }` | `AuthTokens` (hanya untuk peran staf) |
| GET / PATCH | `/me` | `{ name?, username? }` | `User` |
| POST | `/me/password` | `{ current_password, new_password }` — password lama salah → `400 VALIDATION_ERROR` field `current_password`; semua sesi lain dicabut | `{ success: true }` |

### 5.2 Dashboard

| Method | Path | Respons `data` |
|---|---|---|
| GET | `/operator/dashboard/summary?from=&to=` | `{ total_calls, total_cancelled }` |
| GET | `/operator/dashboard/by-case-type?from=&to=` | `[ { code, name, color, count } ]` (urut terbanyak, maks 5) |
| GET | `/operator/dashboard/daily?from=&to=` | `{ dates: ["2026-10-01", …], series: [ { code, name, color, data: [0, 2, …] } ] }` |

### 5.3 Data Kasus Masuk

`GET /operator/requests?q=&case_type=&status=&from=&to=&page=&per_page=`

- `q` mencari nama pasien, alamat, atau No. RM.
- `status` boleh lebih dari satu dipisah koma.

Item:

```json
{
  "id": "...", "code": "SOS-20261012-0042",
  "medical_record_no": "00-01-23", "medical_record_source": "SIMRS", "simrs_status": "FOUND", "simrs_message": null,
  "patient": { "id": "...", "name": "Nama Pasien Lengkap", "identity_number": "3578...", "age_text": "20Th 3Bln 5Hr", "gender": "L" },
  "address": "Jl. Dipatiukur, Lebak Gede, Bandung",
  "case_type": { "$ref": "CaseType" }, "case_type_other": null,
  "status": "MENUNGGU", "status_badge": "PANGGILAN",
  "timeline": [ { "status": "MENUNGGU", "label": "Panggil", "at": "..." } ],
  "offer": { "id": "...", "expires_at": "..." },
  "actions": { "can_accept": true, "can_reject": true },
  "requested_at": "..."
}
```

`offer` hanya ada bila kasus sedang ditawarkan ke penyedia staf tersebut. `simrs_message` berisi keterangan hasil lookup SIMRS (mis. "Belum terdaftar di SIMRS."). Penyedia yang baru ditawari (belum menerima) melihat detail tanpa identitas, foto, dan kontak pelapor.

| Method | Path | Body | Respons `data` |
|---|---|---|---|
| GET | `/operator/requests/:id` | – | Item di atas + `description`, `photos`, `location`, `reporter: { name, phone }`, `provider`, `ambulance`, `eta_seconds` |
| POST | `/operator/requests/:id/accept` | `{ ambulance_id }` | item (status `DITERIMA`). Error `ALREADY_TAKEN` bila didahului penyedia lain. |
| POST | `/operator/requests/:id/reject` | `{ reason }` | `{ success: true }` |
| PUT | `/operator/requests/:id/medical-record` | `{ medical_record_no }` | item |
| POST | `/operator/requests/:id/medical-record/sync` | – | item (lookup ulang ke SIMRS) |

### 5.4 Ambulans

| Method | Path | Body | Respons `data` |
|---|---|---|---|
| GET | `/operator/ambulances?status=&type=` | – | `[ { id, name, plate_number, type, status, photo_url, crew: [ { id, name, on_duty } ] } ]` |
| POST | `/operator/ambulances` | `{ name, plate_number, type, photo_url? }` | ambulans (`FACILITY_ADMIN`) |
| PATCH | `/operator/ambulances/:id` | `{ name?, plate_number?, type?, status?, photo_url? }` | ambulans (`FACILITY_ADMIN`) |

### 5.5 Tracking Ambulance

`GET /operator/trips?q=&status=&from=&to=&page=&per_page=` — `q` mencari nama ambulans / No. Plat.

```json
{ "request_id": "...", "code": "SOS-...", "patient_name": "Adam", "called_at": "...",
  "ambulance": { "id": "...", "name": "Ambulan 001", "plate_number": "L 1234 XYZ" },
  "status": "DALAM_PERJALANAN", "status_badge": "DALAM PERJALANAN",
  "incident_location": { "lat": -7.27, "lng": 112.79 },
  "ambulance_location": { "lat": -7.28, "lng": 112.78, "heading": 90, "updated_at": "..." },
  "route": [ { "lat": -7.29, "lng": 112.77, "at": "..." } ] }
```

`route` hanya dikirim di `GET /operator/trips/:request_id`.

### 5.6 Laporan

| Method | Path | Respons |
|---|---|---|
| GET | `/operator/reports?patient_name=&case_type=&from=&to=&page=&per_page=` | `[ { request_id, no, called_at, ambulance: { name, plate_number }, destination_address, patient: { identity_number, name, gender, age_text }, case_type } ]` + `meta` |
| GET | `/operator/reports/export?format=xlsx&…filter sama` | file `.xlsx` |

### 5.7 Notifikasi

| Method | Path | Respons `data` |
|---|---|---|
| GET | `/operator/notifications?unread=` | `[ { id, type, title, body, request_id, read_at, created_at } ]` + `meta.unread_count` |
| POST | `/operator/notifications/read` | `{ ids?: [] }` (kosong = semua) → `{ success: true }` |

---

## 6. Realtime (Socket.IO)

- URL: `{API_ORIGIN}` path `/realtime` (dev: `http://localhost:4000`, path `/realtime`).
- Handshake: `auth: { token: "<access_token>" }`.
- Server otomatis memasukkan klien ke room sesuai peran: `user:{id}`, `facility:{id}` (staf), `crew:{id}` (petugas).
- Klien dapat ikut room permintaan: emit `subscribe` `{ request_id }`; berhenti: `unsubscribe` `{ request_id }`.

| Event (server → klien) | Payload | Penerima |
|---|---|---|
| `request.updated` | `EmergencyRequest` (versi mobile) atau item operator | pelapor, staf penyedia, petugas |
| `ambulance.location` | `{ request_id, lat, lng, heading, eta_seconds, updated_at }` | room `request:{id}` |
| `offer.created` | item operator + `offer.expires_at` | staf penyedia |
| `offer.withdrawn` | `{ request_id, reason }` | staf penyedia |
| `assignment.created` | `EmergencyRequest` | petugas |
| `notification.created` | notifikasi | staf |

Bila koneksi realtime terputus, klien melakukan polling endpoint detail tiap 10 detik.

---

## 7. File

URL foto (`photos[].url`) adalah URL bertanda tangan yang berlaku 5 menit. Klien tidak menyimpannya permanen; ambil ulang dari endpoint detail bila kedaluwarsa (HTTP 403).
