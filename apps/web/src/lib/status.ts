import type { AmbulanceType, CaseTypeCode, RequestStatus, SimrsStatus } from "./types";

export interface BadgeStyle {
  bg: string;
  fg: string;
}

const GREY: BadgeStyle = { bg: "#D4D8DC", fg: "#6B7280" };
const AMBER: BadgeStyle = { bg: "#FCE0B3", fg: "#B7791F" };
const GREEN: BadgeStyle = { bg: "#9FDDBC", fg: "#1F6E43" };
const BLUE: BadgeStyle = { bg: "#CFE0FB", fg: "#2B64B5" };
const RED: BadgeStyle = { bg: "#F9CFCD", fg: "#B83A37" };
// W5: "Panggilan" is the most urgent state, so it gets the solid warning color instead of grey.
const URGENT: BadgeStyle = { bg: "#E89F29", fg: "#1E1E1E" };

/** Web badge colors per system status (desain_system §12, W5). */
export const STATUS_STYLE: Record<RequestStatus, BadgeStyle> = {
  MENUNGGU: URGENT,
  DITERIMA: AMBER,
  DALAM_PERJALANAN: GREY,
  TIBA: AMBER,
  MENUJU_FASKES: AMBER,
  SAMPAI_DI_FASKES: GREEN,
  SELESAI: BLUE,
  DIBATALKAN: RED,
  TIDAK_TERLAYANI: RED,
};

/** Fallback badge text when the server omits `status_badge` (§1.3). */
export const STATUS_BADGE_TEXT: Record<RequestStatus, string> = {
  MENUNGGU: "PANGGILAN",
  DITERIMA: "DIPROSES",
  DALAM_PERJALANAN: "DALAM PERJALANAN",
  TIBA: "TIBA DI LOKASI",
  MENUJU_FASKES: "MENUJU RS",
  SAMPAI_DI_FASKES: "SAMPAI DI RS",
  SELESAI: "DIPERIKSA",
  DIBATALKAN: "DIBATALKAN",
  TIDAK_TERLAYANI: "TIDAK TERLAYANI",
};

/** Arrow color in the "Data Kunjungan" timeline (mockup: Panggil grey, Diperiksa blue, Dibatalkan red). */
export function timelineArrowColor(status: RequestStatus): string {
  if (status === "MENUNGGU") return "#9D9D9D";
  return STATUS_STYLE[status]?.fg ?? "#9D9D9D";
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export const REQUEST_STATUS_OPTIONS: { value: RequestStatus; label: string }[] = (
  Object.keys(STATUS_BADGE_TEXT) as RequestStatus[]
).map((value) => ({ value, label: titleCase(STATUS_BADGE_TEXT[value]) }));

export const TRIP_STATUS_OPTIONS: { value: RequestStatus; label: string }[] = REQUEST_STATUS_OPTIONS.filter((o) =>
  ["DITERIMA", "DALAM_PERJALANAN", "TIBA", "MENUJU_FASKES", "SAMPAI_DI_FASKES", "SELESAI", "DIBATALKAN"].includes(
    o.value,
  ),
);

/** Fixed chart colors per case type (§12.1) — used when the API `color` is missing. */
export const CASE_TYPE_COLORS: Record<CaseTypeCode, string> = {
  KECELAKAAN: "#4A9FE8",
  NYERI_DADA: "#8CCB5E",
  SESAK_NAFAS: "#F5C842",
  BENCANA_ALAM: "#B57EDC",
  LAINNYA: "#E58BC9",
};

export function caseTypeColor(code: string, apiColor?: string | null): string {
  if (apiColor && /^#[0-9a-f]{3,8}$/i.test(apiColor)) return apiColor;
  return CASE_TYPE_COLORS[code as CaseTypeCode] ?? "#9D9D9D";
}

export const AMBULANCE_TYPE_OPTIONS: { value: AmbulanceType; label: string }[] = [
  { value: "PASIEN", label: "Ambulans Pasien" },
  { value: "GAWAT_DARURAT", label: "Ambulans Gawat Darurat" },
  { value: "JENAZAH", label: "Ambulans Jenazah" },
];

export const SIMRS_HINT: Record<SimrsStatus, { label: string; color: string } | null> = {
  NOT_CONFIGURED: null,
  PENDING: { label: "Mencari di SIMRS…", color: "#6B7280" },
  FOUND: { label: "Terdaftar di SIMRS", color: "#1F6E43" },
  NOT_FOUND: { label: "Belum terdaftar di SIMRS", color: "#B7791F" },
  NO_IDENTITY: { label: "Tanpa identitas", color: "#6B7280" },
  ERROR: { label: "Gagal cek SIMRS", color: "#B83A37" },
};
