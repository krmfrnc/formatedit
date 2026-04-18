import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { appLogger } from '../../common/logger';
import { QueueService } from '../queue/queue.service';
import { FORMATTING_QUEUE } from '../queue/queue.constants';
import type { FormattingJobPayload } from './formatting.types';
import type { QueueJobPayload } from '../queue/queue.types';

@Injectable()
export class FormattingQueueService {
  constructor(private readonly queueService: QueueService) {}

  async enqueueFormattingJob(
    payload: FormattingJobPayload,
  ): Promise<Job<QueueJobPayload>> {
    const queue = this.queueService.getQueue(FORMATTING_QUEUE);

    const queuePayload: QueueJobPayload = {
      documentId: payload.documentId,
      documentVersionId: payload.documentVersionId,
      templateId: payload.templateId,
      requestedBy: payload.requestedBy,
      stage: 'format',
    };

    const job = await queue.add(
      `format:${payload.documentId}:${payload.documentVersionId}`,
      queuePayload,
      {
        jobId: `format:${payload.documentId}:${payload.documentVersionId}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );

    appLogger.info('Formatting job enqueued', {
      documentId: payload.documentId,
      documentVersionId: payload.documentVersionId,
      templateId: payload.templateId,
      jobId: job.id,
    });

    return job;
  }

  async getFormattingJobStatus(jobId: string): Promise<{
    state: string;
    progress: number | null;
    failedReason: string | null;
  }> {
    const queue = this.queueService.getQueue(FORMATTING_QUEUE);
    const job = await queue.getJob(jobId);

    if (!job) {
      return {
        state: 'not-found',
        progress: null,
        failedReason: null,
      };
    }

    const state = await job.getState();
    const failedReason = job.failedReason ?? null;
    const progress = typeof job.progress === 'number' ? job.progress : null;

    return {
      state,
      progress,
      failedReason,
    };
  }
}
