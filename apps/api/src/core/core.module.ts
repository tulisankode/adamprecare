import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../config/app-config.service';
import { AuditService } from './audit.service';
import { CryptoService } from './crypto.service';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [AppConfig, PrismaService, CryptoService, RedisService, AuditService],
  exports: [AppConfig, PrismaService, CryptoService, RedisService, AuditService],
})
export class CoreModule {}
