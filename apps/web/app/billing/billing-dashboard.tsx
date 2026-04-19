'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../_lib/auth/AuthContext';
import type {
  GeoCurrencyResolution,
  InvoiceRecord,
  PaymentRecord,
  StripeSubscriptionCheckoutSessionRecord,
  SubscriptionRecord,
} from '@formatedit/shared';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

type Interval = 'MONTH' | 'YEAR';

interface PlanOption {
  planCode: string;
  label: string;
  interval: Interval;
  priceCents: number;
  features: string[];
  popular?: boolean;
}

const planOptions: PlanOption[] = [
  {
    planCode: 'PRO_MONTHLY',
    label: 'Pro Aylık',
    interval: 'MONTH',
    priceCents: 1900,
    features: ['Sınırsız formatlama', 'Tüm şablonlar', 'Öncelikli destek', 'AI atıf analizi'],
  },
  {
    planCode: 'PRO_YEARLY',
    label: 'Pro Yıllık',
    interval: 'YEAR',
    priceCents: 18000,
    features: ['Sınırsız formatlama', 'Tüm şablonlar', 'Öncelikli destek', 'AI atıf analizi', '2 ay ücretsiz!'],
    popular: true,
  },
];

const statusColors: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Aktif', color: '#10b981' },
  TRIALING: { label: 'Deneme', color: '#3b82f6' },
  PAST_DUE: { label: 'Gecikmiş', color: '#ef4444' },
  CANCELLED: { label: 'İptal', color: '#6b7280' },
  EXPIRED: { label: 'Süresi Doldu', color: '#9ca3af' },
  PENDING: { label: 'Beklemede', color: '#f59e0b' },
};

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(new Date(value));
  } catch {
    return value;
  }
}

export function BillingDashboard() {
  const { token } = useAuth();
  const [currency, setCurrency] = useState('USD');
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>(planOptions[1].planCode);
  const [couponCode, setCouponCode] = useState('');
  const [status, setStatus] = useState('Hazır');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'plans' | 'payments' | 'invoices'>('plans');

  const successUrl = useMemo(() => `${appUrl}/billing?status=success`, []);
  const cancelUrl = useMemo(() => `${appUrl}/billing?status=cancel`, []);
  const selectedOption = useMemo(
    () => planOptions.find((option) => option.planCode === selectedPlan) ?? planOptions[0],
    [selectedPlan],
  );

  useEffect(() => {
    void detectCurrency();
  }, []);

  async function detectCurrency() {
    try {
      const response = await fetch(`${apiUrl}/geo/currency`);
      if (!response.ok) return;
      const body = (await response.json()) as GeoCurrencyResolution;
      setCurrency(body.currency);
    } catch {
      /* fall back */
    }
  }

  function headers(): HeadersInit {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }

  async function loadData() {
    if (!token) {
      setStatus('Önce JWT token girin.');
      return;
    }
    setLoading(true);
    setStatus('Veriler yükleniyor…');
    try {
      const [subsRes, paymentsRes, invoicesRes] = await Promise.all([
        fetch(`${apiUrl}/payments/subscriptions/me`, { headers: headers(), cache: 'no-store' }),
        fetch(`${apiUrl}/payments/me`, { headers: headers(), cache: 'no-store' }),
        fetch(`${apiUrl}/payments/invoices/me`, { headers: headers(), cache: 'no-store' }),
      ]);

      if (subsRes.ok) setSubscriptions((await subsRes.json()) as SubscriptionRecord[]);
      if (paymentsRes.ok) setPayments((await paymentsRes.json()) as PaymentRecord[]);
      if (invoicesRes.ok) setInvoices((await invoicesRes.json()) as InvoiceRecord[]);
      setStatus('Veriler yüklendi.');
    } catch {
      setStatus('API bağlantısı kurulamadı.');
    } finally {
      setLoading(false);
    }
  }

  async function startSubscription() {
    if (!token) {
      setStatus('Önce JWT token girin.');
      return;
    }
    setLoading(true);
    setStatus('Stripe abonelik oturumu açılıyor…');
    try {
      const response = await fetch(`${apiUrl}/payments/stripe/subscription-checkout-session`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          planCode: selectedOption.planCode,
          interval: selectedOption.interval,
          priceCents: selectedOption.priceCents,
          currency,
          successUrl,
          cancelUrl,
          couponCode: couponCode.trim() || undefined,
        }),
      });
      if (!response.ok) {
        setStatus(`Stripe başarısız: ${response.status}`);
        return;
      }
      const body = (await response.json()) as StripeSubscriptionCheckoutSessionRecord;
      if (body.checkoutUrl) {
        window.location.assign(body.checkoutUrl);
      } else {
        setStatus('Checkout URL boş döndü.');
      }
    } catch {
      setStatus('Stripe bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  }

  const activeSub = subscriptions.find((s) => s.status === 'ACTIVE' || s.status === 'TRIALING');

  return (
    <main className="admin-shell" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '2rem', minHeight: '100vh' }}>
      {/* HERO */}
      <section className="glass-panel" style={{ padding: '3rem', borderRadius: '24px' }}>
        <p className="eyebrow" style={{ color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.1em' }}>Billing Center</p>
        <h1 className="text-gradient" style={{ fontSize: '3rem', marginTop: '0.5rem', marginBottom: '1rem', lineHeight: 1.1 }}>
          Abonelik & Fatura Yönetimi
        </h1>
        <p className="copy admin-copy" style={{ color: 'var(--muted)', fontSize: '1.1rem', maxWidth: '700px' }}>
          Abonelik planınızı seçin, ödeme geçmişinizi görüntüleyin ve faturalarınızı indirin.
        </p>
      </section>

      {/* TOOLBAR */}
      <section className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', padding: '1.5rem', borderRadius: '20px', alignItems: 'center' }}>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
          <span className="glass-panel" style={{ padding: '0.6rem 1rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)' }}>
            💱 {currency}
          </span>
          <button className="btn-primary" type="button" onClick={() => void loadData()} disabled={loading} style={{ padding: '0.7rem 1.5rem', width: 'auto' }}>
            {loading ? 'Yükleniyor…' : 'Verileri Getir'}
          </button>
        </div>
      </section>

      {/* STATUS */}
      <div className="glass-panel" style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontSize: '0.9rem' }}>
        <span style={{ color: 'var(--muted)', marginRight: '8px' }}>Durum:</span>
        <span style={{ color: status.includes('başarısız') || status.includes('hata') ? '#ef4444' : status.includes('yüklendi') ? '#10b981' : 'inherit' }}>{status}</span>
      </div>

      {/* ACTIVE SUBSCRIPTION BANNER */}
      {activeSub && (
        <div className="glass-panel" style={{ padding: '1.5rem 2rem', borderRadius: '20px', borderLeft: '4px solid #10b981', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#10b981', fontWeight: 600, textTransform: 'uppercase' }}>Aktif Abonelik</p>
            <p style={{ margin: '0.3rem 0 0 0', fontSize: '1.2rem', fontWeight: 700 }}>
              {activeSub.planCode} · {formatMoney(activeSub.priceCents, activeSub.currency)} / {activeSub.interval === 'MONTH' ? 'ay' : 'yıl'}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>Dönem Sonu</p>
            <p style={{ margin: '0.3rem 0 0 0', fontWeight: 600 }}>{formatDate(activeSub.currentPeriodEnd)}</p>
          </div>
        </div>
      )}

      {/* TABS */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {(['plans', 'payments', 'invoices'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.8rem 1.5rem',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === tab ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
              color: activeTab === tab ? '#fff' : 'var(--text)',
              fontWeight: activeTab === tab ? 600 : 500,
              transition: 'all 0.2s',
            }}
          >
            {tab === 'plans' ? '💎 Planlar' : tab === 'payments' ? '💳 Ödemeler' : '📄 Faturalar'}
          </button>
        ))}
      </div>

      {/* PLANS TAB */}
      {activeTab === 'plans' && (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
          {planOptions.map((plan) => (
            <article
              key={plan.planCode}
              className="glass-panel"
              onClick={() => setSelectedPlan(plan.planCode)}
              style={{
                padding: '2.5rem',
                borderRadius: '24px',
                cursor: 'pointer',
                border: selectedPlan === plan.planCode ? '2px solid var(--accent)' : '2px solid transparent',
                position: 'relative',
                transition: 'all 0.3s',
                transform: selectedPlan === plan.planCode ? 'translateY(-4px)' : 'none',
              }}
            >
              {plan.popular && (
                <span style={{ position: 'absolute', top: '-12px', right: '20px', background: 'var(--accent)', color: '#fff', padding: '0.3rem 1rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
                  EN POPÜLER
                </span>
              )}
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>{plan.label}</h3>
              <p style={{ margin: 0, fontSize: '2.5rem', fontWeight: 700, color: 'var(--accent)' }}>
                {formatMoney(plan.priceCents, currency)}
                <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--muted)' }}> / {plan.interval === 'MONTH' ? 'ay' : 'yıl'}</span>
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '1.5rem 0 0 0', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {plan.features.map((feature) => (
                  <li key={feature} style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: '#10b981' }}>✓</span> {feature}
                  </li>
                ))}
              </ul>
            </article>
          ))}

          <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1, minWidth: '200px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontWeight: 600 }}>Kupon Kodu (opsiyonel)</span>
                <input
                  style={{ padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)' }}
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value)}
                  placeholder="INDIRIM20"
                />
              </label>
              <button className="btn-primary" type="button" onClick={() => void startSubscription()} disabled={loading} style={{ padding: '0.8rem 2rem', width: 'auto', fontSize: '1rem' }}>
                {loading ? 'Yönlendiriliyor…' : `${selectedOption.label} ile Başla →`}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* PAYMENTS TAB */}
      {activeTab === 'payments' && (
        <section className="glass-panel" style={{ padding: '1.5rem', borderRadius: '24px', overflowX: 'auto' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem' }}>Ödeme Geçmişi</h3>
          {payments.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>Ödeme kaydı bulunamadı.</p>
          ) : (
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  {['Sağlayıcı', 'Tip', 'Durum', 'Tutar', 'Tarih'].map((h) => (
                    <th key={h} style={{ padding: '0.8rem 1rem', borderBottom: '2px solid var(--border)', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>{p.provider}</td>
                    <td style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>{p.type === 'ONE_TIME' ? 'Tek Seferlik' : 'Abonelik'}</td>
                    <td style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)' }}>
                      <span style={{
                        padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600,
                        background: p.status === 'SUCCEEDED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: p.status === 'SUCCEEDED' ? '#10b981' : '#ef4444',
                      }}>
                        {p.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', fontWeight: 600 }}>{formatMoney(p.amountCents, p.currency)}</td>
                    <td style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--muted)' }}>{formatDate(p.paidAt ?? p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* INVOICES TAB */}
      {activeTab === 'invoices' && (
        <section className="glass-panel" style={{ padding: '1.5rem', borderRadius: '24px', overflowX: 'auto' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.2rem' }}>Faturalar</h3>
          {invoices.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>Fatura kaydı bulunamadı.</p>
          ) : (
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  {['Fatura No', 'Ara Tutar', 'İndirim', 'Toplam', 'Tarih'].map((h) => (
                    <th key={h} style={{ padding: '0.8rem 1rem', borderBottom: '2px solid var(--border)', textAlign: 'left', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', fontFamily: 'monospace' }}>{inv.invoiceNumber}</td>
                    <td style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>{formatMoney(inv.subtotalCents, inv.currency)}</td>
                    <td style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', color: inv.discountCents > 0 ? '#10b981' : 'var(--muted)' }}>
                      {inv.discountCents > 0 ? `-${formatMoney(inv.discountCents, inv.currency)}` : '—'}
                    </td>
                    <td style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', fontWeight: 600 }}>{formatMoney(inv.totalCents, inv.currency)}</td>
                    <td style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--muted)' }}>{formatDate(inv.issuedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* SUBSCRIPTIONS LIST */}
      {subscriptions.length > 0 && (
        <section className="glass-panel" style={{ padding: '1.5rem', borderRadius: '24px' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Tüm Abonelikler</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {subscriptions.map((sub) => {
              const config = statusColors[sub.status] ?? { label: sub.status, color: '#6b7280' };
              return (
                <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                  <div>
                    <strong style={{ fontSize: '0.95rem' }}>{sub.planCode}</strong>
                    <span style={{ marginLeft: '0.8rem', fontSize: '0.8rem', color: 'var(--muted)' }}>{sub.interval === 'MONTH' ? 'Aylık' : 'Yıllık'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{formatMoney(sub.priceCents, sub.currency)}</span>
                    <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600, background: `${config.color}22`, color: config.color, border: `1px solid ${config.color}44` }}>
                      {config.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
