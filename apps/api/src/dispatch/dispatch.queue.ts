import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AppConfig } from '../config/app-config.service';

export const DISPATCH_QUEUE = 'dispatch';

export type DispatchJob =
  | { name: 'start'; data: { requestId: string } }
  | { name: 'advance'; data: { requestId: string } }
  | { name: 'offer-timeout'; data: { offerId: string } }
  | { name: 'escalate'; data: { requestId: string } }
  | { name: 'unserved'; data: { requestId: string } };

/** Penjadwalan job dispatch (BullMQ) — timer tetap berjalan walau instance API restart. */
@Injectable()
export class DispatchQueue {
  constructor(
    @InjectQueue(DISPATCH_QUEUE) private readonly queue: Queue,
    private readonly config: AppConfig,
  ) {}

  async start(requestId: string) {
    const opts = { removeOnComplete: 1000, removeOnFail: 1000 };
    await this.queue.addBulk([
      { name: 'start', data: { requestId }, opts: { ...opts, jobId: `start-${requestId}` } },
      {
        name: 'escalate',
        data: { requestId },
        opts: { ...opts, jobId: `escalate-${requestId}`, delay: this.config.get('DISPATCH_ESCALATE_AFTER_SECONDS') * 1000 },
      },
      {
        name: 'unserved',
        data: { requestId },
        opts: { ...opts, jobId: `unserved-${requestId}`, delay: this.config.get('DISPATCH_UNSERVED_AFTER_SECONDS') * 1000 },
      },
    ]);
  }

  async advance(requestId: string, delayMs = 0) {
    await this.queue.add('advance', { requestId }, { delay: delayMs, removeOnComplete: 1000, removeOnFail: 1000 });
  }

  async offerTimeout(offerId: string, delayMs: number) {
    await this.queue.add('offer-timeout', { offerId }, { jobId: `offer-${offerId}`, delay: delayMs, removeOnComplete: 1000, removeOnFail: 1000 });
  }
}
