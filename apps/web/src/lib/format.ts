import { formatDistanceToNow, lastDayOfMonth, format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

const TZ = "Asia/Jakarta";

const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const isoDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function parts(d: Date) {
  const out: Record<string, string> = {};
  for (const p of dateTimeFmt.formatToParts(d)) out[p.type] = p.value;
  return out;
}

/** `dd-MM-yyyy HH:mm` in Asia/Jakarta. */
export function formatDateTime(iso: string | null | undefined, sep = " "): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = parts(d);
  const hour = p.hour === "24" ? "00" : p.hour;
  return `${p.day}-${p.month}-${p.year}${sep}${hour}:${p.minute}`;
}

/** `YYYY-MM-DD` → `dd-MM-yyyy` (no timezone shift; used for chart axes). */
export function formatDateLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}-${m}-${y}`;
}

/** Today's date in Asia/Jakarta as `YYYY-MM-DD`. */
export function jakartaToday(): string {
  return isoDateFmt.format(new Date());
}

/** Current calendar month in Asia/Jakarta, as `YYYY-MM-DD` bounds (inclusive). */
export function currentMonthRange(): { from: string; to: string } {
  const today = jakartaToday();
  const [y, m] = today.split("-").map(Number);
  const last = lastDayOfMonth(new Date(y, m - 1, 1));
  return { from: `${today.slice(0, 8)}01`, to: format(last, "yyyy-MM-dd") };
}

export function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatDistanceToNow(d, { addSuffix: true, locale: idLocale });
}

export function formatEta(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  const min = Math.max(1, Math.round(seconds / 60));
  return `± ${min} menit`;
}

export function genderLabel(g: "L" | "P" | null | undefined): string {
  if (g === "L") return "Laki-laki";
  if (g === "P") return "Perempuan";
  return "—";
}
