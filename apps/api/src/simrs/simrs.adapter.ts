export interface SimrsCredentials {
  api_key?: string;
  username?: string;
  password?: string;
}

export interface SimrsConnection {
  /** Konfigurasi non-rahasia per vendor, mis. `{ admisi_base_url }` untuk ADAMEDS. */
  config: Record<string, unknown>;
  /** ID tenant di SIMRS (ADAMEDS: faskes_uuid). */
  externalTenantId: string | null;
  credentials: SimrsCredentials;
  timeoutMs: number;
}

export type SimrsLookupResult = { status: 'FOUND'; medicalRecordNo: string; patientName?: string } | { status: 'NOT_FOUND'; message?: string };

/** Kontrak adapter per vendor SIMRS (desain §7.5). */
export interface SimrsAdapter {
  lookupByIdentity(conn: SimrsConnection, identityNumber: string): Promise<SimrsLookupResult>;
}

/** Error sementara (jaringan/5xx) — job akan dicoba ulang. */
export class SimrsUnavailableError extends Error {}
