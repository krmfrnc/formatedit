'use client';

import { useState, useEffect } from 'react';
import type {
  AnalysisTicketRecord,
  AnalysisTicketDetail,
  TicketMessageRecord,
  AnalysisCategoryRecord,
} from '@formatedit/shared';
import { io, type Socket } from 'socket.io-client';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const realtimeBaseUrl = process.env.NEXT_PUBLIC_WS_URL ?? apiUrl;

const statusLabels: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'Açık', color: '#3b82f6' },
  ASSIGNED: { label: 'Atandı', color: '#8b5cf6' },
  QUOTED: { label: 'Fiyatlandırıldı', color: '#f59e0b' },
  AWAITING_PAYMENT: { label: 'Ödeme Bekliyor', color: '#ef4444' },
  IN_PROGRESS: { label: 'İşlemde', color: '#10b981' },
  DELIVERED: { label: 'Teslim Edildi', color: '#34d399' },
  REVISION_REQUESTED: { label: 'Revizyon', color: '#f97316' },
  CLOSED: { label: 'Kapandı', color: '#6b7280' },
  CANCELLED: { label: 'İptal', color: '#9ca3af' },
};

function StatusBadge({ status }: { status: string }) {
  const config = statusLabels[status] ?? { label: status, color: '#6b7280' };
  return (
    <span
      style={{
        padding: '0.25rem 0.75rem',
        borderRadius: '999px',
        fontSize: '0.7rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        background: `${config.color}22`,
        color: config.color,
        border: `1px solid ${config.color}44`,
      }}
    >
      {config.label}
    </span>
  );
}

export function SupportDashboard() {
  const [token, setToken] = useState('');
  const [tickets, setTickets] = useState<AnalysisTicketRecord[]>([]);
  const [categories, setCategories] = useState<AnalysisCategoryRecord[]>([]);
  const [activeTicket, setActiveTicket] = useState<AnalysisTicketDetail | null>(null);
  const [messages, setMessages] = useState<TicketMessageRecord[]>([]);
  const [status, setStatus] = useState('Analiz sistemi hazır.');
  const [isLoading, setIsLoading] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newBrief, setNewBrief] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newDeliveryMode, setNewDeliveryMode] = useState<'STANDARD' | 'EXPRESS'>('STANDARD');
  const [messageBody, setMessageBody] = useState('');

  function headers(): HeadersInit {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }

  useEffect(() => {
    if (!token || !activeTicket) return;

    const socket: Socket = io(`${realtimeBaseUrl}/analysis`, {
      transports: ['websocket'],
      auth: { token }
    });

    socket.on('connect', () => {
      setStatus('🟢 Canlı desteğe bağlanıldı.');
      socket.emit('ticket:join', { ticketId: activeTicket.id });
    });

    socket.on('support:message', () => {
      void loadTicketDetail(activeTicket.id);
    });

    socket.on('disconnect', () => {
      setStatus('🔴 Canlı destek bağlantısı koptu. REST fallback devrede.');
    });

    return () => {
      socket.disconnect();
    };
  }, [token, activeTicket?.id]);

  async function loadData() {
    if (!token) {
      setStatus('Token gerekli.');
      return;
    }
    setIsLoading(true);
    setStatus('Veriler yükleniyor…');
    try {
      const [ticketsRes, categoriesRes] = await Promise.all([
        fetch(`${apiUrl}/analysis/tickets`, { headers: headers(), cache: 'no-store' }),
        fetch(`${apiUrl}/analysis/categories`, { headers: headers(), cache: 'no-store' }),
      ]);

      if (ticketsRes.ok) {
        const data = (await ticketsRes.json()) as AnalysisTicketRecord[];
        setTickets(data);
      }
      if (categoriesRes.ok) {
        const data = (await categoriesRes.json()) as AnalysisCategoryRecord[];
        setCategories(data);
        if (data.length > 0 && !newCategory) {
          setNewCategory(data[0].slug);
        }
      }
      setStatus(`${tickets.length} talep yüklendi.`);
    } catch {
      setStatus('API bağlantısı kurulamadı.');
    } finally {
      setIsLoading(false);
    }
  }

  async function createTicket() {
    if (!newTitle.trim() || !newBrief.trim()) {
      setStatus('Başlık ve açıklama zorunlu.');
      return;
    }
    setStatus('Talep oluşturuluyor…');
    try {
      const response = await fetch(`${apiUrl}/analysis/tickets`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          title: newTitle,
          brief: newBrief,
          categorySlug: newCategory,
          deliveryMode: newDeliveryMode,
        }),
      });
      if (!response.ok) {
        setStatus('Talep oluşturulamadı.');
        return;
      }
      setNewTitle('');
      setNewBrief('');
      setStatus('✅ Analiz talebi oluşturuldu.');
      await loadData();
    } catch {
      setStatus('Bağlantı hatası.');
    }
  }

  async function loadTicketDetail(ticketId: string) {
    setStatus('Talep detayı yükleniyor…');
    try {
      const [detailRes, messagesRes] = await Promise.all([
        fetch(`${apiUrl}/analysis/tickets/${ticketId}`, { headers: headers(), cache: 'no-store' }),
        fetch(`${apiUrl}/analysis/tickets/${ticketId}/messages`, { headers: headers(), cache: 'no-store' }),
      ]);

      if (detailRes.ok) {
        setActiveTicket((await detailRes.json()) as AnalysisTicketDetail);
      }
      if (messagesRes.ok) {
        setMessages((await messagesRes.json()) as TicketMessageRecord[]);
      }
      setStatus('Hazır');
    } catch {
      setStatus('Detay yüklenemedi.');
    }
  }

  async function sendMessage() {
    if (!activeTicket || !messageBody.trim()) return;
    try {
      const response = await fetch(`${apiUrl}/analysis/tickets/${activeTicket.id}/messages`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ body: messageBody }),
      });
      if (response.ok) {
        setMessageBody('');
        await loadTicketDetail(activeTicket.id);
      }
    } catch {
      setStatus('Mesaj gönderilemedi.');
    }
  }

  async function rateTicket(rating: number) {
    if (!activeTicket) return;
    try {
      await fetch(`${apiUrl}/analysis/tickets/${activeTicket.id}/rate`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ rating, comment: '' }),
      });
      setStatus(`⭐ ${rating}/5 değerlendirme gönderildi.`);
      await loadTicketDetail(activeTicket.id);
    } catch {
      setStatus('Değerlendirme gönderilemedi.');
    }
  }

  return (
    <main className="admin-shell" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '2rem', minHeight: '100vh' }}>
      {/* HERO */}
      <section className="glass-panel" style={{ padding: '3rem', borderRadius: '24px' }}>
        <p className="eyebrow" style={{ color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.1em' }}>Analysis Center</p>
        <h1 className="text-gradient" style={{ fontSize: '3rem', marginTop: '0.5rem', marginBottom: '1rem', lineHeight: 1.1 }}>
          Uzman Analiz Merkezi
        </h1>
        <p className="copy admin-copy" style={{ color: 'var(--muted)', fontSize: '1.1rem', maxWidth: '700px' }}>
          İstatistik, veri bilimi ve akademik analiz taleplerinizi uzman kadromuzla buluşturun. Talep oluşturun, dosya paylaşın, canlı mesajlaşma ile iletişim kurun.
        </p>
      </section>

      {/* TOOLBAR */}
      <section className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', padding: '1.5rem', borderRadius: '20px', alignItems: 'center' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1, minWidth: '200px' }}>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Token</span>
          <input
            type="password"
            style={{ padding: '0.6rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)' }}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="JWT access token"
          />
        </label>
        <div style={{ display: 'flex', gap: '0.8rem', marginTop: 'auto', marginBottom: '2px' }}>
          <button className="btn-primary" type="button" onClick={() => void loadData()} disabled={isLoading} style={{ padding: '0.7rem 1.5rem', width: 'auto' }}>
            {isLoading ? 'Yükleniyor…' : 'Verileri Getir'}
          </button>
          <button className="btn-secondary" type="button" onClick={() => setActiveTicket(null)} style={{ width: 'auto' }}>
            Listeye Dön
          </button>
        </div>
      </section>

      {/* STATUS + STATS */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div className="glass-panel" style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--muted)', marginRight: '8px' }}>Durum:</span>{status}
        </div>
        <div className="glass-panel" style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontSize: '0.9rem', textAlign: 'center' }}>
          <span style={{ color: 'var(--muted)', marginRight: '8px' }}>Toplam Talep:</span>{tickets.length}
        </div>
        <div className="glass-panel" style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontSize: '0.9rem', textAlign: 'center' }}>
          <span style={{ color: 'var(--muted)', marginRight: '8px' }}>Açık:</span>
          <span style={{ color: '#3b82f6', fontWeight: 600 }}>{tickets.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length}</span>
        </div>
        <div className="glass-panel" style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontSize: '0.9rem', textAlign: 'center' }}>
          <span style={{ color: 'var(--muted)', marginRight: '8px' }}>Kategori:</span>{categories.length}
        </div>
      </div>

      {!activeTicket ? (
        /* TICKET LIST + CREATE */
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '2rem', alignItems: 'start' }}>
          {/* TICKET LIST */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem' }}>Taleplerim</h2>
              <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{tickets.length} kayıt</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '600px', overflowY: 'auto' }}>
              {tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => void loadTicketDetail(ticket.id)}
                  style={{
                    textAlign: 'left',
                    padding: '1.2rem 1.5rem',
                    borderRadius: '16px',
                    border: '1px solid var(--border)',
                    background: 'rgba(255,255,255,0.02)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '1rem' }}>{ticket.title}</strong>
                    <StatusBadge status={ticket.status} />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
                    <span>#{ticket.ticketNumber}</span>
                    <span>{ticket.categoryNameSnapshot}</span>
                    <span>{ticket.deliveryMode === 'EXPRESS' ? '⚡ Ekspres' : '📦 Standart'}</span>
                    <span style={{ marginLeft: 'auto' }}>{new Date(ticket.createdAt).toLocaleDateString('tr-TR')}</span>
                  </div>
                </button>
              ))}
              {tickets.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
                  <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Henüz analiz talebiniz yok</p>
                  <p style={{ fontSize: '0.9rem' }}>Sağdaki formdan yeni bir talep oluşturun →</p>
                </div>
              )}
            </div>
          </div>

          {/* CREATE TICKET */}
          <aside className="glass-panel" style={{ padding: '2rem', borderRadius: '24px', position: 'sticky', top: '100px' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem' }}>Yeni Analiz Talebi</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>Başlık *</span>
                <input
                  style={{ padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)' }}
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="Ör: Ki-kare testi ve korelasyon analizi"
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>Açıklama *</span>
                <textarea
                  rows={4}
                  style={{ padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', resize: 'vertical' }}
                  value={newBrief}
                  onChange={(event) => setNewBrief(event.target.value)}
                  placeholder="Analizin kapsamını, veri setinizi ve beklentilerinizi açıklayın…"
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>Kategori</span>
                <select
                  style={{ padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)' }}
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.slug}>{cat.name}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>Teslimat Modu</span>
                <select
                  style={{ padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)' }}
                  value={newDeliveryMode}
                  onChange={(event) => setNewDeliveryMode(event.target.value as 'STANDARD' | 'EXPRESS')}
                >
                  <option value="STANDARD">📦 Standart (5-7 gün)</option>
                  <option value="EXPRESS">⚡ Ekspres (24-48 saat)</option>
                </select>
              </label>
              <button className="btn-primary" type="button" onClick={() => void createTicket()} style={{ marginTop: '0.5rem' }}>
                Talebi Gönder
              </button>
            </div>
          </aside>
        </section>
      ) : (
        /* TICKET DETAIL + CHAT */
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* TICKET HEADER */}
            <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div>
                  <p className="eyebrow" style={{ color: 'var(--accent)', fontWeight: 600, margin: '0 0 0.3rem 0' }}>#{activeTicket.ticketNumber}</p>
                  <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{activeTicket.title}</h2>
                </div>
                <StatusBadge status={activeTicket.status} />
              </div>
              <p style={{ color: 'var(--muted)', margin: '0 0 1.5rem 0', fontSize: '0.95rem', lineHeight: 1.6 }}>{activeTicket.brief}</p>
              <div style={{ display: 'flex', gap: '2rem', fontSize: '0.85rem', color: 'var(--muted)', flexWrap: 'wrap' }}>
                <span>📂 {activeTicket.categoryNameSnapshot}</span>
                <span>{activeTicket.deliveryMode === 'EXPRESS' ? '⚡ Ekspres' : '📦 Standart'}</span>
                <span>📅 {new Date(activeTicket.createdAt).toLocaleDateString('tr-TR')}</span>
                {activeTicket.quotePriceCents != null && (
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>💰 {(activeTicket.quotePriceCents / 100).toFixed(2)} TL</span>
                )}
                {activeTicket.rating != null && (
                  <span>⭐ {activeTicket.rating}/5</span>
                )}
              </div>
            </div>

            {/* MESSAGES */}
            <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.8rem' }}>Mesajlar</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '500px', overflowY: 'auto', paddingRight: '0.5rem' }}>
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
                        maxWidth: '80%',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.8rem', color: isSystem ? '#6366f1' : isCustomer ? 'var(--accent)' : '#10b981' }}>
                          {msg.senderType === 'CUSTOMER' ? 'Siz' : msg.senderType === 'EXPERT' ? 'Uzman' : 'Sistem'}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{new Date(msg.createdAt).toLocaleString('tr-TR')}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>{msg.body}</p>
                    </div>
                  );
                })}
                {messages.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>Henüz mesaj yok.</p>
                )}
              </div>

              {/* MESSAGE INPUT */}
              <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <textarea
                  rows={2}
                  style={{ flex: 1, padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', resize: 'none' }}
                  value={messageBody}
                  onChange={(event) => setMessageBody(event.target.value)}
                  placeholder="Mesajınızı yazın…"
                />
                <button className="btn-primary" type="button" onClick={() => void sendMessage()} style={{ padding: '0.8rem 1.5rem', width: 'auto', alignSelf: 'flex-end' }}>
                  Gönder
                </button>
              </div>
            </div>
          </div>

          {/* SIDEBAR — DETAIL + ACTIONS */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'sticky', top: '100px' }}>
            <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Talep Detayları</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Durum</span>
                  <StatusBadge status={activeTicket.status} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Revizyon</span>
                  <span>{activeTicket.revisionCount} / {activeTicket.maxRevisions}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Dosya</span>
                  <span>{activeTicket.files?.length ?? 0} adet</span>
                </div>
                {activeTicket.deadlineAt && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--muted)' }}>Termin</span>
                    <span>{new Date(activeTicket.deadlineAt).toLocaleDateString('tr-TR')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* RATING */}
            {(activeTicket.status === 'DELIVERED' || activeTicket.status === 'CLOSED') && !activeTicket.rating && (
              <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Değerlendirme</h4>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => void rateTicket(star)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1.5rem',
                        transition: 'transform 0.2s',
                        padding: '0.3rem',
                      }}
                    >
                      ⭐
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* FILES */}
            {(activeTicket.files?.length ?? 0) > 0 && (
              <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Dosyalar</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {activeTicket.files?.map((file) => (
                    <div key={file.id} style={{ padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{file.originalFileName}</span>
                      <span style={{ color: 'var(--muted)' }}>{file.fileType}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </section>
      )}
    </main>
  );
}
