import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import { RedisService } from '../../redis.service';
import { appLogger } from '../../common/logger';
import {
  DOCUMENT_PIPELINE_QUEUE,
  VIRUS_SCAN_QUEUE,
  FORMATTING_QUEUE,
  NOTIFICATIONS_QUEUE,
  type QueueName,
  queueNames,
} from './queue.constants';
import type {
  NotificationJobPayload,
  QueueJobPayload,
  QueueRegistration,
} from './queue.types';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queues = new Map<QueueName, Queue<QueueJobPayload>>();
  private notificationsQueue: Queue<NotificationJobPayload> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  getRegisteredQueues(): QueueRegistration[] {
    return queueNames.map((name) => ({
      name,
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    }));
  }

  getQueue(name: QueueName): Queue<QueueJobPayload> {
    const existingQueue = this.queues.get(name);
    if (existingQueue) {
      return existingQueue;
    }

    const queue = new Queue<QueueJobPayload>(name, {
      connection: this.redisService.getBullConnection(),
      prefix: this.configService.get<string>('queuePrefix', 'formatedit'),
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    });

    this.queues.set(name, queue);
    return queue;
  }

  async enqueueDocumentPipelineJob(
    payload: QueueJobPayload,
  ): Promise<Job<QueueJobPayload>> {
    const queue = this.getQueue(DOCUMENT_PIPELINE_QUEUE);
    const job = await queue.add(
      `${payload.stage}:${payload.documentId}`,
      payload,
    );

    return job;
  }

  async enqueueVirusScanJob(
    payload: QueueJobPayload,
  ): Promise<Job<QueueJobPayload>> {
    const queue = this.getQueue(VIRUS_SCAN_QUEUE);
    return queue.add(`virus-scan:${payload.documentId}`, payload);
  }

  async enqueueParseJob(
    payload: QueueJobPayload,
  ): Promise<Job<QueueJobPayload>> {
    const queue = this.getQueue(DOCUMENT_PIPELINE_QUEUE);
    const jobId = this.getDocumentPipelineJobId(
      'parse',
      payload.documentId,
      payload.documentVersionId,
    );
    return queue.add(
      `parse:${payload.documentId}:${payload.documentVersionId ?? 'unknown'}`,
      payload,
      {
        jobId,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
  }

  async enqueuePdfConversionJob(
    payload: QueueJobPayload,
  ): Promise<Job<QueueJobPayload>> {
    const queue = this.getQueue(DOCUMENT_PIPELINE_QUEUE);
    const jobId = this.getDocumentPipelineJobId(
      'pdf-convert',
      payload.documentId,
      payload.documentVersionId,
    );
    return queue.add(
      `pdf-convert:${payload.documentId}:${payload.documentVersionId ?? 'unknown'}`,
      payload,
      {
        jobId,
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
  }

  createDemoWorker(
    processor: (job: Job<QueueJobPayload>) => Promise<void>,
  ): Worker<QueueJobPayload> {
    return new Worker<QueueJobPayload>(
      DOCUMENT_PIPELINE_QUEUE,
      async (job) => {
        appLogger.info('Processing demo queue job', {
          queue: DOCUMENT_PIPELINE_QUEUE,
          jobId: job.id,
          documentId: job.data.documentId,
          stage: job.data.stage,
        });

        await processor(job);
      },
      {
        autorun: false,
        connection: this.redisService.getBullConnection(),
        prefix: this.configService.get<string>('queuePrefix', 'formatedit'),
      },
    );
  }

  createDocumentPipelineWorker(
    processor: (job: Job<QueueJobPayload>) => Promise<void>,
  ): Worker<QueueJobPayload> {
    return new Worker<QueueJobPayload>(
      DOCUMENT_PIPELINE_QUEUE,
      async (job) => {
        appLogger.info('Processing document pipeline job', {
          queue: DOCUMENT_PIPELINE_QUEUE,
          jobId: job.id,
          documentId: job.data.documentId,
          documentVersionId: job.data.documentVersionId,
          stage: job.data.stage,
        });

        await processor(job);
      },
      {
        autorun: true,
        concurrency: this.configService.get<number>('parseWorkerConcurrency', 2),
        connection: this.redisService.getBullConnection(),
        prefix: this.configService.get<string>('queuePrefix', 'formatedit'),
      },
    );
  }

  private getDocumentPipelineJobId(
    stage: Extract<QueueJobPayload['stage'], 'parse' | 'pdf-convert'>,
    documentId: string,
    documentVersionId?: string,
  ): string {
    return `${stage}:${documentId}:${documentVersionId ?? 'unknown'}`;
  }

  async getDocumentPipelineSnapshot(documentId: string): Promise<{
    parsePending: number;
    pdfConversionPending: number;
  }> {
    const queue = this.getQueue(DOCUMENT_PIPELINE_QUEUE);
    const jobs = await queue.getJobs([
      'active',
      'waiting',
      'delayed',
      'prioritized',
    ]);

    let parsePending = 0;
    let pdfConversionPending = 0;

    for (const job of jobs) {
      if (job.data.documentId !== documentId) {
        continue;
      }

      if (job.data.stage === 'parse') {
        parsePending += 1;
      }

      if (job.data.stage === 'pdf-convert') {
        pdfConversionPending += 1;
      }
    }

    return {
      parsePending,
      pdfConversionPending,
    };
  }

  createFormattingWorker(
    processor: (job: Job<QueueJobPayload>) => Promise<void>,
  ): Worker<QueueJobPayload> {
    return new Worker<QueueJobPayload>(
      FORMATTING_QUEUE,
      async (job) => {
        appLogger.info('Processing formatting job', {
          queue: FORMATTING_QUEUE,
          jobId: job.id,
          documentId: job.data.documentId,
          documentVersionId: job.data.documentVersionId,
          templateId: job.data.templateId,
        });

        await processor(job);
      },
      {
        autorun: true,
        connection: this.redisService.getBullConnection(),
        prefix: this.configService.get<string>('queuePrefix', 'formatedit'),
      },
    );
  }

  /**
   * Task 261/262: Lazy-construct the notifications queue.
   */
  getNotificationsQueue(): Queue<NotificationJobPayload> {
    if (this.notificationsQueue) {
      return this.notificationsQueue;
    }

    this.notificationsQueue = new Queue<NotificationJobPayload>(NOTIFICATIONS_QUEUE, {
      connection: this.redisService.getBullConnection(),
      prefix: this.configService.get<string>('queuePrefix', 'formatedit'),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    });

    return this.notificationsQueue;
  }

  async enqueueNotificationJob(
    payload: NotificationJobPayload,
  ): Promise<Job<NotificationJobPayload>> {
    const queue = this.getNotificationsQueue();
    return queue.add(
      `${payload.channel}:${payload.notificationId}`,
      payload,
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
  }

  createNotificationsWorker(
    processor: (job: Job<NotificationJobPayload>) => Promise<void>,
  ): Worker<NotificationJobPayload> {
    return new Worker<NotificationJobPayload>(
      NOTIFICATIONS_QUEUE,
      async (job) => {
        appLogger.info('Processing notification job', {
          queue: NOTIFICATIONS_QUEUE,
          jobId: job.id,
          notificationId: job.data.notificationId,
          channel: job.data.channel,
          eventType: job.data.eventType,
        });
        await processor(job);
      },
      {
        autorun: true,
        concurrency: this.configService.get<number>('notificationsWorkerConcurrency', 4),
        connection: this.redisService.getBullConnection(),
        prefix: this.configService.get<string>('queuePrefix', 'formatedit'),
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      Array.from(this.queues.values(), async (queue) => queue.close()),
    );
    if (this.notificationsQueue) {
      await this.notificationsQueue.close();
    }
  }
}
