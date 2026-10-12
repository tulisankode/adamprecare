import { Injectable } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { SimrsAdapter, SimrsConnection, SimrsLookupResult, SimrsUnavailableError } from './simrs.adapter';

const NIK_PATTERN = /^\d{16}$/;
const PASSPORT_PATTERN = /^[A-Z]\d{8}$/;

/**
 * Adapter ADAMEDS (wahanameditek-adameds-community) — memakai endpoint yang sudah ada tanpa perubahan di ADAMEDS:
 * `POST {admisi_base_url}/api/v3/admisi/patient/check-patient` dengan header `x-api-key` + `faskes-uuid`.
 * Respons 200 → `payload.no_rm`; 404 "Pasien belum terdaftar".
 */
@Injectable()
export class AdamedsAdapter implements SimrsAdapter {
  async lookupByIdentity(conn: SimrsConnection, identityNumber: string): Promise<SimrsLookupResult> {
    const baseUrl = String(conn.config.admisi_base_url ?? '').replace(/\/+$/, '');
    const apiKey = conn.credentials.api_key;
    const faskesUuid = conn.externalTenantId;
    if (!baseUrl || !apiKey || !faskesUuid) {
      throw new Error('Konfigurasi ADAMEDS belum lengkap (admisi_base_url, api_key, faskes_uuid).');
    }
    const identity = identityNumber.toUpperCase();
    const identityType = NIK_PATTERN.test(identity) ? 'KTP' : PASSPORT_PATTERN.test(identity) ? 'Passport' : null;
    if (!identityType) return { status: 'NOT_FOUND', message: 'Format identitas tidak didukung SIMRS (hanya NIK/paspor).' };

    try {
      const { data } = await axios.post(
        `${baseUrl}/api/v3/admisi/patient/check-patient`,
        { faskes_uuid: faskesUuid, identity: identityType, no_identity: identity },
        { headers: { 'x-api-key': apiKey, 'faskes-uuid': faskesUuid }, timeout: conn.timeoutMs },
      );
      const noRm: unknown = data?.payload?.no_rm ?? data?.payload?.noRm;
      if (typeof noRm !== 'string' || !noRm) return { status: 'NOT_FOUND', message: 'Belum terdaftar di SIMRS.' };
      return { status: 'FOUND', medicalRecordNo: noRm, patientName: data.payload.name };
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      if (status === 404) return { status: 'NOT_FOUND', message: 'Belum terdaftar di SIMRS.' };
      if (status === 401 || status === 403) throw new Error('Akses ke ADAMEDS ditolak (periksa API key / faskes_uuid).');
      if (status && status < 500) throw new Error(`ADAMEDS menolak permintaan (HTTP ${status}).`);
      throw new SimrsUnavailableError(`ADAMEDS tidak dapat dihubungi: ${(err as Error).message}`);
    }
  }
}
