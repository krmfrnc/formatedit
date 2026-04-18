/**
 * Task 296: Storybook component library story for the NotificationBell component.
 */
import type { Meta, StoryObj } from '@storybook/react';
import NotificationBell, { type NotificationItem } from './notification-bell';

const sampleItems: NotificationItem[] = [
  {
    id: 'notification_1',
    eventType: 'analysis_tickets.quoted',
    title: 'New quote ready',
    body: 'Your statistical analysis ticket is ready for review.',
    createdAt: '2026-04-17T08:30:00.000Z',
  },
  {
    id: 'notification_2',
    eventType: 'documents.formatted',
    title: 'Formatting completed',
    body: 'The latest thesis preview is available for download.',
    createdAt: '2026-04-17T07:15:00.000Z',
    readAt: '2026-04-17T07:30:00.000Z',
  },
];

const meta: Meta<typeof NotificationBell> = {
  component: NotificationBell,
  title: 'Notifications / Bell',
  args: {
    initialToken: 'storybook-token',
    initialItems: sampleItems,
    initialUnread: 1,
    disableRemoteSync: true,
  },
  parameters: {
    layout: 'centered',
  },
};
export default meta;

export const Default: StoryObj<typeof NotificationBell> = {};

export const EmptyState: StoryObj<typeof NotificationBell> = {
  args: {
    initialItems: [],
    initialUnread: 0,
  },
};

export const BusyInbox: StoryObj<typeof NotificationBell> = {
  args: {
    initialItems: [
      sampleItems[0] as NotificationItem,
      sampleItems[1] as NotificationItem,
      {
        id: 'notification_3',
        eventType: 'payments.succeeded',
        title: 'Payment confirmed',
        body: 'Stripe payment for ticket AN-24001 was captured successfully.',
        createdAt: '2026-04-17T06:40:00.000Z',
      },
    ],
    initialUnread: 12,
  },
};
