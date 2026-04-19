'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { AnalysisTicketRecord } from '@formatedit/shared';
import { useAuthContext } from '../_lib/AuthContext';
import { useTranslation } from '../_lib/i18n/useTranslation';
import { analysisApiUrl, formatDate, ticketStatuses } from './_shared';

interface TicketListResponse {
  items: AnalysisTicketRecord[];
  total: number;
}

export default function AnalysisListPage() {
  const { t } = useTranslation();
  const { authFetch, isAuthenticated } = useAuthContext();
  const [tickets, setTickets] = useState<AnalysisTicketRecord[]>([]);
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      const res = await authFetch(`${analysisApiUrl}/analysis/tickets${qs}`);
      if (!res.ok) throw new Error('failed');
      const data = (await res.json()) as TicketListResponse;
      setTickets(data.items);
    } catch {
      setError(t('analysis.detail.load_error'));
    } finally {
      setLoading(false);
    }
  }, [authFetch, isAuthenticated, status, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <section
        className="glass-panel"
        style={{ padding: '2.5rem', borderRadius: '24px', marginBottom: '2rem' }}
      >
        <p className="eyebrow" style={{ color: 'var(--accent)', fontWeight: 600 }}>
          {t('analysis.eyebrow')}
        </p>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1
              className="text-gradient"
              style={{ fontSize: '2.4rem', lineHeight: 1.1, margin: '0.5rem 0' }}
            >
              {t('analysis.list_title')}
            </h1>
            <p style={{ color: 'var(--muted)', margin: 0 }}>{t('analysis.list_subtitle')}</p>
          </div>
          <Link
            href="/analysis/new"
            className="btn-primary"
            style={{ padding: '0.8rem 1.6rem', textDecoration: 'none' }}
          >
            {t('analysis.new_ticket')}
          </Link>
        </div>
      </section>

      <section
        className="glass-panel"
        style={{ padding: '1.5rem', borderRadius: '20px', marginBottom: '1.5rem' }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--muted)' }}>
            {t('analysis.filter_status')}
          </span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.7)',
              outline: 'none',
            }}
          >
            <option value="">{t('analysis.filter_all')}</option>
            {ticketStatuses.map((s) => (
              <option key={s} value={s}>
                {t(`analysis.status.${s}`)}
              </option>
            ))}
          </select>
        </label>
      </section>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>{t('analysis.detail.loading')}</p>
      ) : error ? (
        <p role="alert" style={{ color: '#ef4444' }}>
          {error}
        </p>
      ) : tickets.length === 0 ? (
        <section
          className="glass-panel"
          style={{ padding: '2.5rem', borderRadius: '20px', textAlign: 'center' }}
        >
          <h2 style={{ marginTop: 0 }}>{t('analysis.empty_title')}</h2>
          <p style={{ color: 'var(--muted)' }}>{t('analysis.empty_body')}</p>
          <Link
            href="/analysis/new"
            className="btn-primary"
            style={{ padding: '0.8rem 1.6rem', textDecoration: 'none', display: 'inline-block' }}
          >
            {t('analysis.new_ticket')}
          </Link>
        </section>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '1rem' }}>
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/analysis/${ticket.id}`}
                className="glass-panel"
                style={{
                  display: 'block',
                  padding: '1.5rem',
                  borderRadius: '18px',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: '1rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--muted)',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {ticket.ticketNumber} · {ticket.categoryNameSnapshot}
                    </div>
                    <strong style={{ fontSize: '1.15rem', display: 'block', marginTop: '0.25rem' }}>
                      {ticket.title}
                    </strong>
                  </div>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.3rem 0.75rem',
                      borderRadius: '999px',
                      background: 'rgba(0,0,0,0.06)',
                      fontWeight: 600,
                    }}
                  >
                    {t(`analysis.status.${ticket.status}`)}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: '1.5rem',
                    marginTop: '0.75rem',
                    fontSize: '0.85rem',
                    color: 'var(--muted)',
                  }}
                >
                  <span>{formatDate(ticket.createdAt)}</span>
                  <span>{t(`analysis.delivery.${ticket.deliveryMode}`)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
