import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { ok } from '../common/response';
import { latSchema, lngSchema } from '../common/validators';
import { ZodPipe } from '../common/zod.pipe';
import { GeoService } from './geo.service';

const reverseSchema = z.object({ lat: latSchema, lng: lngSchema });
const searchSchema = z.object({ q: z.string().trim().min(3, 'Kata kunci minimal 3 karakter.').max(200) });

@Throttle({ default: { limit: 30, ttl: 60000 } })
@Controller('geocode')
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('reverse')
  async reverse(@Query(new ZodPipe(reverseSchema)) q: z.infer<typeof reverseSchema>) {
    return ok({ address: await this.geo.reverse(q.lat, q.lng) });
  }

  @Get('search')
  async search(@Query(new ZodPipe(searchSchema)) q: z.infer<typeof searchSchema>) {
    return ok(await this.geo.search(q.q));
  }
}
