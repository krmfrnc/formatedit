'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { AnalysisTicketDetail, TicketMessageRecord } from '@formatedit/shared';
import { useTranslation } from '../../../_lib/i18n/useTranslation';
import { useAuthContext } from '../../../_lib/AuthContext';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const statusLabels: Record<string, { labelKey: string; color: string }> = {
  OPEN: { labelKey: 'analysis.status_open', color: '#3b82f6' },
  ASSIGNED: { labelKey: 'analysis.status_assigned', color: '#8b5cf6' },
  QUOTED: { labelKey: 'analysis.status_quoted', color: '#f59e0b' },
  AWAITING_PAYMENT: { labelKey: 'analysis.status_awaiting_payment', color: '#ef4444' },
  IN_PROGRESS: { labelKey: 'analysis.status_in_progress', color: '#10b981' },
  DELIVERED: { labelKey: 'analysis.status_delivered', color: '#34d399' },
  REVISION_REQUESTED: { labelKey: 'analysis.status_revision', color: '#f97316' },
  CLOSED: { labelKey: 'analysis.status_closed', color: '#6b7280' },
  CANCELLED: { labelKey: 'analysis.status_cancelled', color: '#9ca3af' },
};

function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const config = statusLabels[status] ?? { labelKey: status, color: '#6b7280' };
  const label = statusLabels[status] ? t(config.labelKey) : status;
  return (
    <span
      style={{
        padding: '0.25rem 0.75rem',
        borderRadius: '999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        background: `${config.color}22`,
        color: config.color,
        border: `1px solid ${config.color}44`,
        display: 'inline-block',
      }}
    >
      {label}
    </span>
  );
}

export default function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { token } = useAuthContext();

  const [ticket, setTicket] = useState<AnalysisTicketDetail | null>(null);
  const [messages, setMessages] = useState<TicketMessageRecord[]>([]);
  const [messageBody, setMessageBody] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadTicket = useCallback(async () => {
    if (!token || !ticketId) return;
    try {
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const [detailRes, messagesRes] = await Promise.all([
        fetch(`${apiUrl}/analysis/tickets/${ticketId}`, { headers, cache: 'no-store' }),
        fetch(`${apiUrl}/analysis/tickets/${ticketId}/messages`, { headers, cache: 'no-store' })
      ]);

      if (!detailRes.ok) throw new Error('Bilet detayı yüklenemedi');

      const detailData = await detailRes.json() as AnalysisTicketDetail;
      setTicket(detailData);

      if (messagesRes.ok) {
        const msgData = await messagesRes.json() as TicketMessageRecord[];
        setMessages(msgData);
      }
    } catch (err: any) {
      setErrorMsg(err.message || t('analysis.error_loading'));
    } finally {
      setIsLoading(false);
    }
  }, [ticketId, token, t]);

  useEffect(() => {
    void loadTicket();
  }, [loadTicket]);

  const sendMessage = async () => {
    if (!messageBody.trim() || !token) return;
    setIsSending(true);
    try {
      const response = await fetch(`${apiUrl}/analysis/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body: messageBody }),
      });
      if (response.ok) {
        setMessageBody('');
        await loadTicket();
      } else {
        setErrorMsg(t('analysis.error_sending_message'));
      }
    } catch {
      setErrorMsg(t('analysis.error_network'));
    } finally {
      setIsSending(false);
    }
  };

  const handleQuoteAction = async (action: 'approve' | 'reject') => {
    if (!token) return;
    setActionLoading(true);
    try {
      const response = await fetch(`${apiUrl}/analysis/tickets/${ticketId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        await loadTicket();
      } else {
        setErrorMsg(t(`analysis.error_${action}`));
      }
    } catch {
      setErrorMsg(t('analysis.error_network'));
    } finally {
      setActionLoading(false);
    }
  };

  if (!ticketId || (!token && !isLoading)) return null;

  if (isLoading) {
    return (
      <main className="admin-shell" style={{ padding: '4rem 2rem', display: 'flex', justifyContent: 'center' }}>
        <p style={{ color: 'var(--muted)' }}>{t('common.loading')}...</p>
      </main>
    );
  }

  if (errorMsg && !ticket) {
    return (
      <main className="admin-shell" style={{ padding: '4rem 2rem', display: 'flex', justifyContent: 'center' }}>
        <p style={{ color: '#ef4444' }}>{errorMsg}</p>
        <button type="button" className="btn-secondary" onClick={() => router.push('/analysis')} style={{ marginTop: '1rem' }}>
          {t('analysis.back_to_list')}
        </button>
      </main>
    );
  }

  if (!ticket) return null;

  return (
    <main className="admin-shell" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', minHeight: '100vh', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Navigation Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button type="button" className="btn-secondary" onClick={() => router.push('/analysis')} style={{ padding: '0.6rem 1rem' }}>
          ← {t('analysis.back')}
        </button>
        <h1 className="text-gradient" style={{ margin: 0, fontSize: '2rem' }}>
          {t('analysis.ticket_detail_title')}
        </h1>
      </div>

      {errorMsg && (
        <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '12px' }}>
          {errorMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem', alignItems: 'start' }}>
        
        {/* Main Content Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Header Ticket Summary */}
          <section className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <p className="eyebrow" style={{ color: 'var(--accent)', fontWeight: 600, margin: '0 0 0.3rem 0' }}>
                  #{ticket.ticketNumber}
                </p>
                <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{ticket.title}</h2>
              </div>
              <StatusBadge status={ticket.status} t={t} />
            </div>
            
            <p style={{ color: 'var(--muted)', margin: '0 0 1.5rem 0', fontSize: '1rem', lineHeight: 1.6 }}>
              {ticket.brief}
            </p>
            
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: 'var(--muted)', flexWrap: 'wrap' }}>
              <span>📂 {ticket.categoryNameSnapshot}</span>
              <span>{ticket.deliveryMode === 'EXPRESS' ? '⚡ ' + t('analysis.express') : '📦 ' + t('analysis.standard')}</span>
              <span>📅 {new Date(ticket.createdAt).toLocaleDateString()}</span>
            </div>
          </section>

          {/* QUOTE ACTIONS */}
          {ticket.status === 'QUOTED' && ticket.quotePriceCents != null && (
            <section className="glass-panel" style={{ padding: '2rem', borderRadius: '24px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: '#f59e0b' }}>{t('analysis.quote_received')}</h3>
                  <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>
                    {t('analysis.quote_amount')}: <strong style={{ color: 'var(--accent)', fontSize: '1.2rem' }}>{(ticket.quotePriceCents / 100).toLocaleString()} ₺</strong>
                  </p>
                  {ticket.quoteNote && (
                    <p style={{ margin: '0.5rem 0 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>"{ticket.quoteNote}"</p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="button" className="btn-secondary" disabled={actionLoading} onClick={() => void handleQuoteAction('reject')}>
                    {t('analysis.reject_quote')}
                  </button>
                  <button type="button" className="btn-primary" disabled={actionLoading} onClick={() => void handleQuoteAction('approve')} style={{ background: '#f59e0b', color: '#fff', border: 'none' }}>
                    {t('analysis.approve_quote')}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* MESSAGES THREAD */}
          <section className="glass-panel" style={{ padding: '2rem', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.8rem' }}>
              {t('analysis.messages')}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {messages.map((msg) => {
                const isCustomer = msg.senderType === 'CUSTOMER';
                const isSystem = msg.senderType === 'SYSTEM';
                return (
                  <div
                    key={msg.id}
                    style={{
                      padding: '1rem 1.25rem',
                      borderRadius: '16px',
                      background: isSystem ? 'rgba(99, 102, 241, 0.08)' : isCustomer ? 'rgba(217, 119, 6, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                      borderLeft: `4px solid ${isSystem ? '#6366f1' : isCustomer ? 'var(--accent)' : '#10b981'}`,
                      alignSelf: isCustomer ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '1rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.8rem', color: isSystem ? '#6366f1' : isCustomer ? 'var(--accent)' : '#10b981' }}>
                        {t(`analysis.sender_${msg.senderType.toLowerCase()}`)}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                        {new Date(msg.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {msg.body}
                    </p>
                  </div>
                );
              })}
              {messages.length === 0 && (
                <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem 0' }}>{t('analysis.no_messages')}</p>
              )}
            </div>

            {/* SEND MESSAGE INPUT */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
              <textarea
                rows={3}
                style={{ flex: 1, padding: '1rem', borderRadius: '16px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', resize: 'vertical' }}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder={t('analysis.message_placeholder')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    void sendMessage();
                  }
                }}
              />
              <button
                className="btn-primary"
                type="button"
                onClick={() => void sendMessage()}
                disabled={isSending || !messageBody.trim()}
                style={{ padding: '0.8rem 1.5rem', width: 'auto', alignSelf: 'flex-end', borderRadius: '14px' }}
              >
                {t('common.send')}
              </button>
            </div>
          </section>
        </div>

        {/* Sidebar Info */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'sticky', top: '100px' }}>
          
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '24px' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>{t('analysis.ticket_summary')}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--muted)' }}>{t('analysis.status')}</span>
                <StatusBadge status={ticket.status} t={t} />
              </div>
              {ticket.deadlineAt && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>{t('analysis.deadline')}</span>
                  <span style={{ fontWeight: 600 }}>{new Date(ticket.deadlineAt).toLocaleDateString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>{t('analysis.revisions')}</span>
                <span>{ticket.revisionCount} / {ticket.maxRevisions}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>{t('analysis.files_count')}</span>
                <span>{ticket.files?.length ?? 0}</span>
              </div>
            </div>
          </div>

          {(ticket.files?.length ?? 0) > 0 && (
            <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '24px' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>{t('analysis.uploaded_files')}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {ticket.files?.map((f) => (
                  <div key={f.id} style={{ padding: '0.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                      {f.originalFileName}
                    </span>
                    <span style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>
                      {f.fileType === 'DATA' ? '📁 Veri' : f.fileType === 'DESCRIPTION' ? '📄 Açıklama' : '📦 Örnek'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </aside>
      </div>
    </main>
  );
}
