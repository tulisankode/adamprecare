import { RequestStatus } from '@prisma/client';

/** Status aktif (belum final). Sinkron dengan partial unique index di migrasi. */
export const ACTIVE_STATUSES: RequestStatus[] = ['MENUNGGU', 'DITERIMA', 'DALAM_PERJALANAN', 'TIBA', 'MENUJU_FASKES', 'SAMPAI_DI_FASKES'];
export const FINAL_STATUSES: RequestStatus[] = ['SELESAI', 'DIBATALKAN', 'TIDAK_TERLAYANI'];
/** Pelapor boleh membatalkan selama ambulans belum tiba (desain §5.3). */
export const CANCELLABLE_STATUSES: RequestStatus[] = ['MENUNGGU', 'DITERIMA', 'DALAM_PERJALANAN'];
/** Status ketika ambulans sedang bergerak/bertugas dan lokasinya dilacak. */
export const TRACKED_STATUSES: RequestStatus[] = ['DITERIMA', 'DALAM_PERJALANAN', 'TIBA', 'MENUJU_FASKES', 'SAMPAI_DI_FASKES'];

/** Transisi yang diizinkan (desain §5.3). */
export const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  MENUNGGU: ['DITERIMA', 'DIBATALKAN', 'TIDAK_TERLAYANI'],
  DITERIMA: ['DALAM_PERJALANAN', 'DIBATALKAN'],
  DALAM_PERJALANAN: ['TIBA', 'DIBATALKAN'],
  TIBA: ['MENUJU_FASKES', 'SELESAI'],
  MENUJU_FASKES: ['SAMPAI_DI_FASKES'],
  SAMPAI_DI_FASKES: ['SELESAI'],
  SELESAI: [],
  DIBATALKAN: [],
  TIDAK_TERLAYANI: [],
};

/** Kolom waktu yang diisi saat masuk ke status tertentu. */
export const STATUS_TIMESTAMP: Partial<Record<RequestStatus, string>> = {
  DITERIMA: 'acceptedAt',
  DALAM_PERJALANAN: 'departedAt',
  TIBA: 'arrivedAt',
  MENUJU_FASKES: 'transportingAt',
  SAMPAI_DI_FASKES: 'reachedFacilityAt',
  SELESAI: 'completedAt',
  DIBATALKAN: 'cancelledAt',
  TIDAK_TERLAYANI: 'unservedAt',
};

/** Badge dashboard web (docs/api_contract.md §1.3). */
export const STATUS_BADGE: Record<RequestStatus, string> = {
  MENUNGGU: 'PANGGILAN',
  DITERIMA: 'DIPROSES',
  DALAM_PERJALANAN: 'DALAM PERJALANAN',
  TIBA: 'TIBA DI LOKASI',
  MENUJU_FASKES: 'MENUJU RS',
  SAMPAI_DI_FASKES: 'SAMPAI DI RS',
  SELESAI: 'DIPERIKSA',
  DIBATALKAN: 'DIBATALKAN',
  TIDAK_TERLAYANI: 'TIDAK TERLAYANI',
};

/** Label baris "Data Kunjungan". */
export const TIMELINE_LABEL: Record<RequestStatus, string> = {
  MENUNGGU: 'Panggil',
  DITERIMA: 'Diproses',
  DALAM_PERJALANAN: 'Dalam Perjalanan',
  TIBA: 'Tiba di Lokasi',
  MENUJU_FASKES: 'Menuju RS',
  SAMPAI_DI_FASKES: 'Sampai di RS',
  SELESAI: 'Diperiksa',
  DIBATALKAN: 'Dibatalkan',
  TIDAK_TERLAYANI: 'Tidak Terlayani',
};

/** Judul layar status aplikasi mobile. */
export function statusLabel(status: RequestStatus, providerName?: string | null, destinationName?: string | null): string {
  switch (status) {
    case 'MENUNGGU':
      return 'Mencari ambulans terdekat…';
    case 'DITERIMA':
      return `Ambulans dari ${providerName ?? 'penyedia'} sedang disiapkan`;
    case 'DALAM_PERJALANAN':
      return 'Ambulans dan petugas sedang dalam perjalanan';
    case 'TIBA':
      return 'Ambulans telah tiba di lokasi';
    case 'MENUJU_FASKES':
      return `Pasien sedang dibawa ke ${destinationName ?? 'fasilitas kesehatan'}`;
    case 'SAMPAI_DI_FASKES':
      return `Pasien telah tiba di ${destinationName ?? 'fasilitas kesehatan'}`;
    case 'SELESAI':
      return 'Permintaan selesai';
    case 'DIBATALKAN':
      return 'Permintaan dibatalkan';
    case 'TIDAK_TERLAYANI':
      return 'Belum ada ambulans tersedia. Hubungi 119.';
  }
}
