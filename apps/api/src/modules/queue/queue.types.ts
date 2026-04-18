import type { JobsOptions } from 'bullmq';

export interface QueueJobPayload {
  documentId: string;
  stage: 'parse' | 'format' | 'preview' | 'virus-scan' | 'pdf-convert';
  requestedBy: string;
  documentVersionId?: string;
  storageKey?: string;
  templateId?: string;
}

/**
 * Task 261: Payload enqueued onto the notifications queue. A separately-typed
 * payload keeps the notification worker strongly typed and prevents accidental
 * cross-wiring with the document pipeline queue.
 */
export interface NotificationJobPayload {
  notificationId: string;
  userId: string;
  channel: 'EMAIL' | 'IN_APP' | 'WHATSAPP' | 'TELEGRAM';
  eventType: string;
}

export interface QueueRegistration {
  name: string;
  defaultJobOptions?: JobsOptions;
}
