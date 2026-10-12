import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { ServerOptions } from 'socket.io';

/** Adapter Socket.IO berbasis Redis agar event tersebar ke semua instance API. */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private clients: Redis[] = [];

  constructor(
    app: INestApplicationContext,
    private readonly redisUrl: string,
    private readonly corsOrigins: string[],
  ) {
    super(app);
  }

  connect() {
    const pub = new Redis(this.redisUrl);
    const sub = pub.duplicate();
    this.clients = [pub, sub];
    this.adapterConstructor = createAdapter(pub, sub);
  }

  async dispose() {
    await super.dispose();
    await Promise.all(this.clients.map((c) => c.quit().catch(() => undefined)));
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, {
      ...options,
      cors: { origin: this.corsOrigins.length ? this.corsOrigins : true, credentials: true },
    });
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    return server;
  }
}
