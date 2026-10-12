import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DISPATCH_QUEUE } from './dispatch.queue';
import { DispatchService } from './dispatch.service';

@Processor(DISPATCH_QUEUE)
export class DispatchProcessor extends WorkerHost {
  private readonly logger = new Logger(DispatchProcessor.name);

  constructor(private readonly dispatch: DispatchService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'start':
      case 'advance':
        return this.dispatch.advance(job.data.requestId);
      case 'offer-timeout':
        return this.dispatch.offerTimeout(job.data.offerId);
      case 'escalate':
        return this.dispatch.escalate(job.data.requestId);
      case 'unserved':
        return this.dispatch.markUnserved(job.data.requestId);
      default:
        this.logger.warn(`Job dispatch tidak dikenal: ${job.name}`);
    }
  }
}
