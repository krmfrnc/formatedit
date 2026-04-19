import type { AnalysisTicketRecord } from '@formatedit/shared';

export const analysisApiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type TicketStatus = AnalysisTicketRecord['status'];

export const ticketStatuses: TicketStatus[] = [
  'OPEN',
  'ASSIGNED',
  'QUOTED',
  'AWAITING_PAYMENT',
  'IN_PROGRESS',
  'DELIVERED',
  'REVISION_REQUESTED',
  'CLOSED',
  'CANCELLED',
];

export function formatDate(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function formatPriceCents(priceCents: number | null, currency = 'TRY'): string {
  if (priceCents == null) return '—';
  const amount = priceCents / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
