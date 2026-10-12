import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { AppConfig } from '../config/app-config.service';
import { CryptoService } from '../core/crypto.service';

const URL_TTL_SECONDS = 300;

/**
 * Penyimpanan berkas privat. Implementasi saat ini: disk lokal (`UPLOAD_DIR`) dengan URL bertanda tangan
 * berumur 5 menit. Antarmuka sengaja sederhana agar bisa diganti S3-compatible tanpa mengubah pemanggil.
 */
@Injectable()
export class StorageService {
  private readonly root: string;

  constructor(
    private readonly config: AppConfig,
    private readonly crypto: CryptoService,
  ) {
    this.root = path.resolve(config.get('UPLOAD_DIR'));
  }

  async put(key: string, data: Buffer): Promise<void> {
    const file = this.resolve(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  signedUrl(key: string): string {
    const exp = Math.floor(Date.now() / 1000) + URL_TTL_SECONDS;
    const sig = this.crypto.hmac(this.config.get('FILE_URL_SECRET'), `${key}:${exp}`);
    return `${this.config.get('API_PUBLIC_URL')}/v1/files/${key}?exp=${exp}&sig=${sig}`;
  }

  verify(key: string, exp: number, sig: string): boolean {
    if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
    return this.crypto.safeEqual(sig, this.crypto.hmac(this.config.get('FILE_URL_SECRET'), `${key}:${exp}`));
  }

  private resolve(key: string): string {
    const file = path.resolve(this.root, key);
    if (!file.startsWith(this.root + path.sep)) throw new Error('Kunci berkas tidak valid');
    return file;
  }
}
