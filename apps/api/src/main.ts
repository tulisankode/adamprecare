import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AppConfig } from './config/app-config.service';
import { RedisIoAdapter } from './realtime/redis-io.adapter';

export async function configureApp(app: NestExpressApplication) {
  const config = app.get(AppConfig);
  const origins = config.get('CORS_ORIGINS');
  app.setGlobalPrefix('v1');
  app.enableCors({ origin: origins.length ? origins : true, credentials: true, exposedHeaders: ['Content-Disposition'] });
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.useBodyParser('json', { limit: '1mb' });
  const io = new RedisIoAdapter(app, config.get('REDIS_URL'), origins);
  io.connect();
  app.useWebSocketAdapter(io);
  app.enableShutdownHooks();
  return config;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = await configureApp(app);
  const port = config.get('PORT');
  await app.listen(port);
  Logger.log(`Adam PreCare API berjalan di http://localhost:${port}/v1 (realtime: path /realtime)`, 'Bootstrap');
}

if (require.main === module) {
  void bootstrap();
}
