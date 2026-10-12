import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { OtpService } from './auth/otp.service';
import { TokenService } from './auth/token.service';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { validateEnv } from './config/env';
import { ContentController } from './content/content.controller';
import { CoreModule } from './core/core.module';
import { CrewController } from './crew/crew.controller';
import { TrackingService } from './crew/tracking.service';
import { DISPATCH_QUEUE, DispatchQueue } from './dispatch/dispatch.queue';
import { DispatchProcessor } from './dispatch/dispatch.processor';
import { DispatchService } from './dispatch/dispatch.service';
import { EmergencyController } from './emergency/emergency.controller';
import { EmergencyService } from './emergency/emergency.service';
import { RequestPresenter } from './emergency/request.presenter';
import { StatusService } from './emergency/status.service';
import { FacilitiesController } from './facilities/facilities.controller';
import { GeoController } from './geo/geo.controller';
import { GeoService } from './geo/geo.service';
import { NotificationsService } from './notifications/notifications.service';
import { OperatorDashboardController } from './operator/operator-dashboard.controller';
import { OperatorRequestsController } from './operator/operator-requests.controller';
import { OperatorTrackingController } from './operator/operator-tracking.controller';
import { PatientsController } from './patients/patients.controller';
import { RealtimeGateway } from './realtime/realtime.gateway';
import { RealtimeService } from './realtime/realtime.service';
import { AdamedsAdapter } from './simrs/adameds.adapter';
import { MockSimrsAdapter } from './simrs/mock.adapter';
import { SimrsProcessor } from './simrs/simrs.processor';
import { SIMRS_QUEUE, SimrsQueue } from './simrs/simrs.queue';
import { SimrsService } from './simrs/simrs.service';
import { FilesController } from './storage/files.controller';
import { StorageService } from './storage/storage.service';
import { MeController } from './users/me.controller';
import { UserPresenter } from './users/user.presenter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    CoreModule,
    JwtModule.register({}),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 300 }]),
    BullModule.forRootAsync({
      useFactory: () => {
        const url = new URL(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379');
        return {
          connection: { host: url.hostname, port: Number(url.port || 6379), password: url.password || undefined },
          prefix: process.env.NODE_ENV === 'test' ? 'apc-test' : 'apc',
        };
      },
    }),
    BullModule.registerQueue({ name: DISPATCH_QUEUE }, { name: SIMRS_QUEUE }),
  ],
  controllers: [
    AuthController,
    MeController,
    ContentController,
    GeoController,
    FacilitiesController,
    EmergencyController,
    PatientsController,
    CrewController,
    OperatorDashboardController,
    OperatorRequestsController,
    OperatorTrackingController,
    FilesController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    TokenService,
    OtpService,
    AuthService,
    UserPresenter,
    GeoService,
    StorageService,
    RealtimeService,
    RealtimeGateway,
    NotificationsService,
    RequestPresenter,
    StatusService,
    EmergencyService,
    DispatchQueue,
    DispatchService,
    DispatchProcessor,
    TrackingService,
    SimrsQueue,
    SimrsService,
    SimrsProcessor,
    AdamedsAdapter,
    MockSimrsAdapter,
  ],
})
export class AppModule {}
