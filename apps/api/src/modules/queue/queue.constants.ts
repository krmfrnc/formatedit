export const DOCUMENT_PIPELINE_QUEUE = 'document-pipeline';
export const VIRUS_SCAN_QUEUE = 'virus-scan';
export const FORMATTING_QUEUE = 'formatting';
export const NOTIFICATIONS_QUEUE = 'notifications-queue';

export const queueNames = [
  DOCUMENT_PIPELINE_QUEUE,
  VIRUS_SCAN_QUEUE,
  FORMATTING_QUEUE,
  NOTIFICATIONS_QUEUE,
] as const;

export type QueueName = (typeof queueNames)[number];
