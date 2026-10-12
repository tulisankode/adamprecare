# Adam PreCare: Web Dashboard

This is the operator dashboard for **Adam PreCare** (Pre-Hospital & Incident Emergency System). Facility operators and admins use it (`FACILITY_OPERATOR`, `FACILITY_ADMIN`, `SUPER_ADMIN`) to receive SOS cases, assign ambulances, track trips live and export reports.

The API contract is in [`docs/api_contract.md`](../../docs/api_contract.md). The design reference is in [`docs/desain_system.md`](../../docs/desain_system.md) (§3.6, §12, §13.1) and the mockups in `docs/web/`.

## Stack

- Next.js 15.5 (App Router, TypeScript strict), React 19, Tailwind CSS 4 (CSS-first `@theme` tokens in `src/app/globals.css`)
- TanStack Query 5 + axios (auth refresh interceptor), zod 3 + react-hook-form
- socket.io-client 4.8 (realtime), Recharts 3 (charts), Leaflet 1.9 + react-leaflet 5 with OpenStreetMap tiles (no API key)
- date-fns (`id` locale), lucide-react icons, sonner toasts, Poppins via `next/font`

## Getting started

The repo root is an npm workspace (`apps/api`, `apps/web`).

```bash
# from the repo root
npm install
cp apps/web/.env.example apps/web/.env.local   # adjust if the API is not on localhost:4000
npm run dev:web                                # = npm run dev -w apps/web → http://localhost:3000
```

The dashboard needs the API (`apps/api`) running at `NEXT_PUBLIC_API_BASE_URL`. Log in with a staff **username** and password (`POST /auth/staff/login`). Accounts with any other role are refused with an error message.

### Scripts (run inside `apps/web` or with `-w apps/web`)

| Script | What it does |
|---|---|
| `npm run dev` | Dev server on port **3000** |
| `npm run build` | Production build |
| `npm run start` | Serve the production build on port 3000 |
| `npm run lint` | ESLint (`next/core-web-vitals` + `next/typescript`) |
| `npm run typecheck` | `tsc --noEmit` |

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:4000/v1` | REST base URL (includes `/v1`) |
| `NEXT_PUBLIC_SOCKET_URL` | `http://localhost:4000` | Socket.IO origin |
| `NEXT_PUBLIC_SOCKET_PATH` | `/realtime` | Socket.IO path |

These are inlined at build time, so rebuild after you change them.

## Structure

```
src/
  app/
    login/                 Login (split layout)
    (app)/layout.tsx       Client-side auth guard + app shell
    (app)/dashboard        Summary cards, Top 5 donut, daily line chart
    (app)/kasus            Data Kasus Masuk (+ detail panel, Proses Ambulans panel, reject dialog)
    (app)/tracking         Tracking Ambulans + Live Tracking map
    (app)/laporan          Laporan with expandable rows + Excel export
    (app)/profil           Profil saya + Ubah Password
  components/
    shell/                 Header, sidebar/drawer, notification bell, avatar menu, realtime bridge
    ui/                    Buttons, fields, badges, pagination, states, page card, side panel/dialog
    kasus/ tracking/ dashboard/ maps/
  lib/
    api.ts                 axios instance, single-flight token refresh, {data}/{data,meta} unwrapping, ApiError
    auth-store.ts          In-memory access token + user; refresh token in localStorage (`apc.refresh`)
    socket.ts              Singleton Socket.IO client + connection status
    queries.ts             React Query hooks for every operator endpoint
    types.ts               Contract types
    format.ts status.ts    Asia/Jakarta date formatting, status badge colors and labels
```

## Behaviour notes

- **Auth.** The access token is kept in memory only. The refresh token is stored in `localStorage["apc.refresh"]`. When a request gets a 401 `UNAUTHENTICATED`, the client calls `POST /auth/refresh` once, queues concurrent requests behind it, then retries. If the refresh fails, the user is logged out and sent to `/login`. Tokens are also refreshed 60 s before they expire.
- **Realtime.** The socket connects with `auth: { token }`. The token is re-read on every reconnect, and an auth rejection triggers a token refresh followed by a reconnect.
  - `offer.created` plays a short WebAudio alarm, shows a toast and refreshes the case list.
  - `request.updated` and `offer.withdrawn` refresh the case, trip and dashboard data.
  - `notification.created` updates the bell.
  - The green dot on the avatar means the socket is connected. While it is disconnected, the case, trip and detail queries poll every 10 s.
- **Dates.** Dates are displayed as `dd-MM-yyyy HH:mm` in Asia/Jakarta. Filters are sent as `YYYY-MM-DD` and default to the current month.
- **Static assets.** `public/logo.png`, `public/login-illustration.png` and `public/ambulance-placeholder.jpg` were cropped from the mockups in `docs/web/`.
