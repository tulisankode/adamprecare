import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { AppConfig } from '../config/app-config.service';

/**
 * Enkripsi kolom (AES-256-GCM) untuk NIK/kredensial, HMAC untuk pencarian tanpa dekripsi,
 * dan hash token. Format ciphertext: base64(iv[12] | tag[16] | data).
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;
  private readonly pepper: string;

  constructor(config: AppConfig) {
    this.key = Buffer.from(config.get('DATA_ENCRYPTION_KEY'), 'base64');
    this.pepper = config.get('HASH_PEPPER');
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
  }

  decrypt(payload: string | null | undefined): string | null {
    if (!payload) return null;
    const raw = Buffer.from(payload, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  }

  /** HMAC deterministik untuk mencari nilai terenkripsi (mis. NIK). */
  blindIndex(value: string): string {
    return createHmac('sha256', this.pepper).update(value.trim().toUpperCase()).digest('hex');
  }

  sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  hmac(secret: string, value: string): string {
    return createHmac('sha256', secret).update(value).digest('base64url');
  }

  safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
  }

  randomToken(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }

  otpCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }
}
