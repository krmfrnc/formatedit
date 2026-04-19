'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  AnalysisTicketRecord,
  CouponValidationRecord,
  GeoCurrencyResolution,
  PayPalOrderRecord,
  StripeCheckoutSessionRecord,
} from '@formatedit/shared';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

interface Props {
  ticketId: string;
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function CheckoutForm({ ticketId }: Props) {
  const [token, setToken] = useState('');
  const [ticket, setTicket] = useState<AnalysisTicketRecord | null>(null);
  const [currency, setCurrency] = useState('USD');
  const [currencySource, setCurrencySource] = useState<GeoCurrencyResolution['source'] | 'manual'>(
    'default',
  );
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState<CouponValidationRecord | null>(null);
  const [status, setStatus] = useState('Hazır');
  const [loading, setLoading] = useState(false);

  const baseAmountCents = ticket?.quotePriceCents ?? 0;
  const finalAmountCents = coupon?.finalAmountCents ?? baseAmountCents;
  const discountCents = coupon?.discountCents ?? 0;

  const successUrl = useMemo(
    () => `${appUrl}/checkout/${ticketId}/success`,
    [ticketId],
  );
  const cancelUrl = useMemo(
    () => `${appUrl}/checkout/${ticketId}/cancel`,
    [ticketId],
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
      setCurrencySource(body.source);
    } catch {
      // ignore — keep default USD
    }
  }

  function headers(): HeadersInit {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }

  async function loadTicket() {
    if (!token) {
      setStatus('Önce JWT token girin.');
      return;
    }
    setLoading(true);
    setStatus('Talep yükleniyor…');
    try {
      const response = await fetch(`${apiUrl}/analysis/tickets/${ticketId}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!response.ok) {
        setStatus(`Talep alınamadı (${response.status}).`);
        return;
      }
      const body = (await response.json()) as AnalysisTicketRecord;
      setTicket(body);
      setStatus(`✅ ${body.ticketNumber} yüklendi.`);
    } catch {
      setStatus('API bağlantısı kurulamadı.');
    } finally {
      setLoading(false);
    }
  }

  async function applyCoupon() {
    if (!couponCode.trim()) {
      setCoupon(null);
      setStatus('Kupon kaldırıldı.');
      return;
    }
    if (!token || !ticket) {
      setStatus('Önce talebi yükleyin.');
      return;
    }
    setLoading(true);
    setStatus('Kupon kontrol ediliyor…');
    try {
      const response = await fetch(`${apiUrl}/payments/coupons/validate`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          code: couponCode,
          amountCents: baseAmountCents,
          currency,
        }),
      });
      if (!response.ok) {
        setCoupon(null);
        setStatus(`Kupon geçersiz (${response.status}).`);
        return;
      }
      const body = (await response.json()) as CouponValidationRecord;
      setCoupon(body);
      setStatus(`✅ Kupon uygulandı: -${formatMoney(body.discountCents, currency)}`);
    } catch {
      setStatus('Kupon doğrulama başarısız.');
    } finally {
      setLoading(false);
    }
  }

  async function startStripeCheckout() {
    if (!token || !ticket) return;
    setLoading(true);
    setStatus('Stripe oturumu açılıyor…');
    try {
      const response = await fetch(`${apiUrl}/payments/stripe/checkout-session`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          analysisTicketId: ticket.id,
          successUrl,
          cancelUrl,
          currency,
          ...(coupon ? { couponCode: coupon.code } : {}),
        }),
      });
      if (!response.ok) {
        setStatus(`Stripe başarısız (${response.status}).`);
        return;
      }
      const body = (await response.json()) as StripeCheckoutSessionRecord;
      if (body.checkoutUrl) {
        window.location.assign(body.checkoutUrl);
      } else {
        setStatus('Stripe checkout URL boş döndü.');
      }
    } catch {
      setStatus('Stripe bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  }

  async function startPayPalCheckout() {
    if (!token || !ticket) return;
    setLoading(true);
    setStatus('PayPal siparişi oluşturuluyor…');
    try {
      const response = await fetch(`${apiUrl}/payments/paypal/order`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          analysisTicketId: ticket.id,
          returnUrl: successUrl,
          cancelUrl,
          currency,
          ...(coupon ? { couponCode: coupon.code } : {}),
        }),
      });
      if (!response.ok) {
        setStatus(`PayPal başarısız (${response.status}).`);
        return;
      }
      const body = (await response.json()) as PayPalOrderRecord;
      if (body.approveUrl) {
        window.location.assign(body.approveUrl);
      } else {
        setStatus('PayPal approve URL boş döndü.');
      }
    } catch {
      setStatus('PayPal bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-shell" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '2rem', minHeight: '100vh', maxWidth: '800px', margin: '0 auto' }}>
      {/* HERO */}
      <section className="glass-panel" style={{ padding: '2.5rem', borderRadius: '24px', textAlign: 'center' }}>
        <p className="eyebrow" style={{ color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.1em' }}>Checkout</p>
        <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginTop: '0.5rem', marginBottom: '1rem', lineHeight: 1.1 }}>
          Güvenli Ödeme
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '1rem' }}>
          💱 {currency} ({currencySource})
        </p>
      </section>

      {/* AUTH */}
      <section className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
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
        <button className="btn-primary" type="button" onClick={() => void loadTicket()} disabled={loading} style={{ padding: '0.6rem 1.5rem', width: 'auto' }}>
          Talebi Yükle
        </button>
      </section>

      {/* STATUS */}
      <div className="glass-panel" style={{ padding: '0.75rem 1.5rem', borderRadius: '12px', fontSize: '0.9rem' }}>
        <span style={{ color: 'var(--muted)', marginRight: '8px' }}>Durum:</span>
        <span style={{ color: status.includes('başarısız') || status.includes('hatası') || status.includes('geçersiz') ? '#ef4444' : status.includes('✅') ? '#10b981' : 'inherit' }}>{status}</span>
      </div>

      {/* TICKET DETAIL */}
      {ticket && (
        <section className="glass-panel" style={{ padding: '2rem', borderRadius: '24px', borderLeft: '4px solid var(--accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600 }}>#{ticket.ticketNumber}</p>
              <h2 style={{ margin: '0.3rem 0 0 0', fontSize: '1.3rem' }}>{ticket.title}</h2>
            </div>
            <span style={{
              padding: '0.3rem 0.8rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600,
              background: ticket.status === 'AWAITING_PAYMENT' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              color: ticket.status === 'AWAITING_PAYMENT' ? '#ef4444' : '#10b981',
            }}>
              {ticket.status}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted)' }}>
            Teklif: {ticket.quotePriceCents ? (
              <strong style={{ color: 'var(--text)', fontSize: '1.1rem' }}>{formatMoney(ticket.quotePriceCents, currency)}</strong>
            ) : (
              <span style={{ color: '#f59e0b' }}>Henüz teklif yok</span>
            )}
          </p>
        </section>
      )}

      {/* COUPON + PAYMENT */}
      {ticket && ticket.quotePriceCents ? (
        <>
          {/* COUPON */}
          <section className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>🎫 Kupon Kodu</h3>
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <input
                type="text"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                placeholder="ÖRN: STUDENT20"
                style={{ flex: 1, padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', fontFamily: 'monospace', letterSpacing: '0.1em' }}
              />
              <button className="btn-secondary" type="button" onClick={() => void applyCoupon()} disabled={loading} style={{ width: 'auto' }}>
                Uygula
              </button>
            </div>
            {coupon && (
              <p style={{ margin: '0.8rem 0 0 0', color: '#10b981', fontWeight: 600, fontSize: '0.9rem' }}>
                ✅ {coupon.name}: -{formatMoney(coupon.discountCents, currency)} indirim
              </p>
            )}
          </section>

          {/* PRICE SUMMARY */}
          <section className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>Sipariş Özeti</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                <span style={{ color: 'var(--muted)' }}>Ara Tutar</span>
                <span>{formatMoney(baseAmountCents, currency)}</span>
              </div>
              {discountCents > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                  <span style={{ color: '#10b981' }}>İndirim</span>
                  <span style={{ color: '#10b981' }}>-{formatMoney(discountCents, currency)}</span>
                </div>
              )}
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0.5rem 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 700 }}>
                <span>Toplam</span>
                <span style={{ color: 'var(--accent)' }}>{formatMoney(finalAmountCents, currency)}</span>
              </div>
            </div>
          </section>

          {/* PAYMENT BUTTONS */}
          <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <button
              className="btn-primary"
              type="button"
              onClick={() => void startStripeCheckout()}
              disabled={loading}
              style={{ padding: '1.2rem', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              💳 Stripe ile Öde
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => void startPayPalCheckout()}
              disabled={loading}
              style={{ padding: '1.2rem', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'rgba(0, 112, 186, 0.1)', borderColor: '#0070ba44', color: '#0070ba' }}
            >
              🅿️ PayPal ile Öde
            </button>
          </section>
        </>
      ) : null}
    </main>
  );
}
