import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

export const SIMRS_QUEUE = 'simrs';

@Injectable()
export class SimrsQueue {
  constructor(@InjectQueue(SIMRS_QUEUE) private readonly queue: Queue) {}

  /** Cari No. RM pasien di SIMRS penyedia yang menerima kasus (retry 3x dengan backoff). */
  async lookup(requestId: string) {
    await this.queue.add(
      'lookup',
      { requestId },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 1000, removeOnFail: 1000 },
    );
  }
}
