/** Helper format tampilan & waktu (zona Asia/Jakarta). */

export const JAKARTA_OFFSET_MINUTES = 7 * 60;

/** Batas rentang tanggal `from`/`to` (YYYY-MM-DD, inklusif) dalam WIB → UTC. */
export function jakartaRange(from?: string, to?: string): { gte?: Date; lt?: Date } {
  const range: { gte?: Date; lt?: Date } = {};
  if (from) range.gte = new Date(Date.parse(`${from}T00:00:00+07:00`));
  if (to) range.lt = new Date(Date.parse(`${to}T00:00:00+07:00`) + 24 * 3600 * 1000);
  return range;
}

/** Tanggal (YYYY-MM-DD) di WIB untuk sebuah waktu. */
export function jakartaDate(at: Date): string {
  return new Date(at.getTime() + JAKARTA_OFFSET_MINUTES * 60000).toISOString().slice(0, 10);
}

/** Daftar tanggal WIB dari `from` sampai `to` inklusif. */
export function dateList(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86400000) {
    dates.push(new Date(t).toISOString().slice(0, 10));
  }
  return dates;
}

export function currentMonthRange(now = new Date()): { from: string; to: string } {
  const today = jakartaDate(now);
  const [y, m] = today.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, '0')}` };
}

/** "20Th 3Bln 5Hr" bila tanggal lahir ada, "20 Th" bila hanya umur, "-" bila kosong. */
export function ageText(birthDate: Date | null | undefined, ageYears: number | null | undefined, now = new Date()): string {
  if (birthDate) {
    const b = new Date(birthDate);
    let years = now.getUTCFullYear() - b.getUTCFullYear();
    let months = now.getUTCMonth() - b.getUTCMonth();
    let days = now.getUTCDate() - b.getUTCDate();
    if (days < 0) {
      months -= 1;
      days += new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).getUTCDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    return `${years}Th ${months}Bln ${days}Hr`;
  }
  if (ageYears !== null && ageYears !== undefined) return `${ageYears} Th`;
  return '-';
}

/** Samarkan nomor: tampilkan 4 digit awal & `tail` digit akhir. */
export function mask(value: string | null | undefined, tail = 4): string | null {
  if (!value) return null;
  if (value.length <= 4 + tail) return `${value.slice(0, 2)}${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-2)}`;
  return `${value.slice(0, 4)}${'*'.repeat(value.length - 4 - tail)}${value.slice(-tail)}`;
}

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  return `${phone.slice(0, 6)}****${phone.slice(-3)}`;
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}***@${domain}`;
}

export function genderLabel(g: 'L' | 'P' | null | undefined): string {
  return g === 'L' ? 'Laki-laki' : g === 'P' ? 'Perempuan' : '-';
}

/** Jarak garis lurus (km) dua titik. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
