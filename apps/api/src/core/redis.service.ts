import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfig } from '../config/app-config.service';

/** Koneksi Redis untuk cache (geocode, ETA, token layanan SIMRS). */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(config: AppConfig) {
    this.client = new Redis(config.get('REDIS_URL'), { maxRetriesPerRequest: 2 });
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
