import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { SimrsAdapter, SimrsLookupResult } from './simrs.adapter';

/**
 * SIMRS tiruan untuk development & demo: identitas berakhiran digit genap dianggap terdaftar
 * dengan No. RM deterministik format `NN-NN-NN`; selain itu "belum terdaftar".
 */
@Injectable()
export class MockSimrsAdapter implements SimrsAdapter {
  async lookupByIdentity(_conn: unknown, identityNumber: string): Promise<SimrsLookupResult> {
    const lastDigit = Number(identityNumber.slice(-1));
    if (Number.isNaN(lastDigit) || lastDigit % 2 === 1) return { status: 'NOT_FOUND', message: 'Belum terdaftar di SIMRS.' };
    const n = parseInt(createHash('sha256').update(identityNumber).digest('hex').slice(0, 8), 16) % 1_000_000;
    const padded = String(n).padStart(6, '0');
    return { status: 'FOUND', medicalRecordNo: `${padded.slice(0, 2)}-${padded.slice(2, 4)}-${padded.slice(4)}` };
  }
}
