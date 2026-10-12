import { Body, Controller, Get, HttpCode, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { z } from 'zod';
import { ok, paged, Pagination, paginationSchema, skipTake } from '../common/response';
import { uuidSchema } from '../common/validators';
import { ZodPipe } from '../common/zod.pipe';
import { AuthUser, CurrentUser, Roles } from '../auth/auth.decorators';
import { cancelSchema, CreateRequestInput, createRequestSchema } from './emergency.schemas';
import { EmergencyService } from './emergency.service';
import { RequestPresenter } from './request.presenter';

@Roles('USER')
@Controller('emergency-requests')
export class EmergencyController {
  constructor(
    private readonly emergency: EmergencyService,
    private readonly presenter: RequestPresenter,
  ) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createRequestSchema)) body: CreateRequestInput) {
    return ok(this.presenter.forMobile(await this.emergency.create(user.id, body)));
  }

  @Post(':id/photos')
  @UseInterceptors(FileInterceptor('photo', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  async photo(@CurrentUser() user: AuthUser, @Param('id', new ZodPipe(uuidSchema)) id: string, @UploadedFile() file?: Express.Multer.File) {
    return ok(await this.emergency.addPhoto(user.id, id, file));
  }

  @Get('active')
  async active(@CurrentUser() user: AuthUser) {
    const request = await this.emergency.activeFor(user.id);
    return ok(request ? this.presenter.forMobile(request) : null);
  }

  @Get()
  async history(@CurrentUser() user: AuthUser, @Query(new ZodPipe(paginationSchema)) q: Pagination) {
    const { skip, take } = skipTake(q);
    const { items, total } = await this.emergency.history(user.id, skip, take);
    return paged(items.map((r) => this.presenter.forMobile(r)), total, q.page, q.per_page);
  }

  @Get(':id')
  async detail(@CurrentUser() user: AuthUser, @Param('id', new ZodPipe(uuidSchema)) id: string) {
    return ok(this.presenter.forMobile(await this.emergency.getOwned(user.id, id)));
  }

  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', new ZodPipe(uuidSchema)) id: string,
    @Body(new ZodPipe(cancelSchema)) body: z.infer<typeof cancelSchema>,
  ) {
    return ok(this.presenter.forMobile(await this.emergency.cancel(user.id, id, body.reason)));
  }
}
