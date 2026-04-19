'use client';

import { useState } from 'react';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

interface AffiliateSummary {
  affiliate: {
    id: string;
    code: string;
    status: 'ACTIVE' | 'SUSPENDED';
    commissionPercent: number;
  };
  referralCount: number;
  convertedCount: number;
  earnedCents: number;
  pendingCents: number;
  paidCents: number;
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function AffiliateDashboard() {
  const [token, setToken] = useState('');
  const [summary, setSummary] = useState<AffiliateSummary | null>(null);
  const [status, setStatus] = useState('Hazır');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  function headers(): HeadersInit {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }

  async function loadSummary() {
    if (!token) return setStatus('Önce JWT girin.');
    setLoading(true);
    setStatus('Yükleniyor…');
    try {
      const response = await fetch(`${apiUrl}/affiliates/me`, { headers: headers() });
      if (response.status === 404) {
        setSummary(null);
        setStatus('Henüz affiliate değilsiniz. "Programa Katıl" diyerek başlayın.');
        return;
      }
      if (!response.ok) {
        setStatus(`Hata: ${response.status}`);
        return;
      }
      const data = (await response.json()) as AffiliateSummary;
      setSummary(data);
      setStatus('Hazır');
    } catch {
      setStatus('API bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  }

  async function enroll() {
    if (!token) return setStatus('Önce JWT girin.');
    setLoading(true);
    setStatus('Kayıt oluşturuluyor…');
    try {
      const response = await fetch(`${apiUrl}/affiliates/me/enroll`, {
        method: 'POST',
        headers: headers(),
      });
      if (!response.ok) {
        setStatus(`Hata: ${response.status}`);
        return;
      }
      setStatus('✅ Affiliate programına katıldınız!');
      await loadSummary();
    } catch {
      setStatus('Bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  }

  const shareUrl = summary ? `${appUrl}/?ref=${summary.affiliate.code}` : '';

  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="admin-shell" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '2rem', minHeight: '100vh' }}>
      {/* HERO */}
      <section className="glass-panel" style={{ padding: '3rem', borderRadius: '24px' }}>
        <p className="eyebrow" style={{ color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.1em' }}>Affiliate Program</p>
        <h1 className="text-gradient" style={{ fontSize: '3rem', marginTop: '0.5rem', marginBottom: '1rem', lineHeight: 1.1 }}>
          Referans Programı
        </h1>
        <p className="copy admin-copy" style={{ color: 'var(--muted)', fontSize: '1.1rem', maxWidth: '700px' }}>
          Arkadaşlarınızı davet edin, her başarılı dönüşümden komisyon kazanın. Paylaşım linkinizi kopyalayın ve kazanmaya başlayın.
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
        <div style={{ display: 'flex', gap: '0.8rem', marginTop: 'auto' }}>
          <button className="btn-primary" type="button" onClick={() => void loadSummary()} disabled={loading} style={{ padding: '0.7rem 1.5rem', width: 'auto' }}>
            {loading ? 'Yükleniyor…' : 'Özeti Getir'}
          </button>
          {!summary && (
            <button className="btn-secondary" type="button" onClick={() => void enroll()} disabled={loading} style={{ width: 'auto', background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', borderColor: '#8b5cf644' }}>
              Programa Katıl
            </button>
          )}
        </div>
      </section>

      {/* STATUS */}
      <div className="glass-panel" style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontSize: '0.9rem' }}>
        <span style={{ color: 'var(--muted)', marginRight: '8px' }}>Durum:</span>
        <span style={{ color: status.includes('Hata') || status.includes('hatası') ? '#ef4444' : status.includes('✅') ? '#10b981' : 'inherit' }}>{status}</span>
      </div>

      {summary && (
        <>
          {/* REFERRAL LINK */}
          <section className="glass-panel" style={{ padding: '2rem', borderRadius: '24px', borderLeft: `4px solid ${summary.affiliate.status === 'ACTIVE' ? '#10b981' : '#ef4444'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Referans Kodunuz</p>
                <p style={{ margin: '0.3rem 0 0 0', fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent)' }}>{summary.affiliate.code}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{
                  padding: '0.3rem 0.8rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600,
                  background: summary.affiliate.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: summary.affiliate.status === 'ACTIVE' ? '#10b981' : '#ef4444',
                }}>
                  {summary.affiliate.status === 'ACTIVE' ? 'AKTİF' : 'ASKIDA'}
                </span>
                <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>%{summary.affiliate.commissionPercent} komisyon</span>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                readOnly
                value={shareUrl}
                style={{ flex: 1, padding: '0.7rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontSize: '0.85rem' }}
              />
              <button className="btn-primary" type="button" onClick={() => void copyLink()} style={{ padding: '0.7rem 1.2rem', width: 'auto', fontSize: '0.85rem' }}>
                {copied ? '✅ Kopyalandı!' : '📋 Kopyala'}
              </button>
            </div>
          </section>

          {/* STATS */}
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem' }}>
            {[
              { label: 'Ziyaret', value: summary.referralCount, color: '#3b82f6' },
              { label: 'Dönüşüm', value: summary.convertedCount, color: '#8b5cf6' },
              { label: 'Toplam Kazanç', value: formatMoney(summary.earnedCents), color: '#10b981' },
              { label: 'Bekleyen', value: formatMoney(summary.pendingCents), color: '#f59e0b' },
              { label: 'Ödenen', value: formatMoney(summary.paidCents), color: '#34d399' },
            ].map((stat) => (
              <article key={stat.label} className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>{stat.label}</span>
                <strong style={{ display: 'block', fontSize: '1.8rem', marginTop: '0.5rem', color: stat.color }}>{stat.value}</strong>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
