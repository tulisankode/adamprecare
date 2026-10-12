import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SIMRS_QUEUE } from './simrs.queue';
import { SimrsService } from './simrs.service';

@Processor(SIMRS_QUEUE)
export class SimrsProcessor extends WorkerHost {
  constructor(private readonly simrs: SimrsService) {
    super();
  }

  async process(job: Job<{ requestId: string }>): Promise<void> {
    const final = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    await this.simrs.lookup(job.data.requestId, { final });
  }
}
