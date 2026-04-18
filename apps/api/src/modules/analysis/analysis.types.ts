export interface AnalysisCategoryUpsertInput {
  slug: string;
  name: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface AnalysisAddOnUpsertInput {
  slug: string;
  name: string;
  description?: string;
  priceCents: number;
  isActive?: boolean;
}

export interface AnalysisTicketCreateInput {
  categorySlug: string;
  title: string;
  brief: string;
  deliveryMode?: 'STANDARD' | 'EXPRESS';
}

export interface CreateTicketNdaInput {
  expertUserId: string;
  documentStorageKey?: string;
}

export interface SubmitQuoteInput {
  priceCents: number;
  note?: string;
  deadlineAt?: string;
}

export interface RequestRevisionInput {
  reason: string;
}

export interface RateTicketInput {
  rating: number;
  comment?: string;
}

export interface SendTicketMessageInput {
  body: string;
  metadata?: Record<string, unknown>;
}

export interface TicketListFilter {
  status?: string;
  categorySlug?: string;
  deliveryMode?: string;
  page?: number;
  limit?: number;
}
