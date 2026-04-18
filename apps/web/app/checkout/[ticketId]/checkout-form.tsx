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

  async function loadTicket() {
    if (!token) {
      setStatus('Önce JWT token girin');
      return;
    }
    setLoading(true);
    setStatus('Ticket yükleniyor');
    try {
      const response = await fetch(`${apiUrl}/analysis/tickets/${ticketId}`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!response.ok) {
        setStatus(`Ticket alınamadı (${response.status})`);
        return;
      }
      const body = (await response.json()) as AnalysisTicketRecord;
      setTicket(body);
      setStatus(`${body.ticketNumber} yüklendi`);
    } catch {
      setStatus('API bağlantısı kurulamadı');
    } finally {
      setLoading(false);
    }
  }

  async function applyCoupon() {
    if (!couponCode.trim()) {
      setCoupon(null);
      setStatus('Kupon kaldırıldı');
      return;
    }
    if (!token || !ticket) {
      setStatus('Önce ticket yükleyin');
      return;
    }
    setLoading(true);
    setStatus('Kupon kontrol ediliyor');
    try {
      const response = await fetch(`${apiUrl}/payments/coupons/validate`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: couponCode,
          amountCents: baseAmountCents,
          currency,
        }),
      });
      if (!response.ok) {
        const message = await response.text();
        setCoupon(null);
        setStatus(`Kupon geçersiz: ${message || response.status}`);
        return;
      }
      const body = (await response.json()) as CouponValidationRecord;
      setCoupon(body);
      setStatus(
        `Kupon uygulandı: -${formatMoney(body.discountCents, currency)} indirim`,
      );
    } catch {
      setStatus('Kupon doğrulama başarısız');
    } finally {
      setLoading(false);
    }
  }

  async function startStripeCheckout() {
    if (!token || !ticket) return;
    setLoading(true);
    setStatus('Stripe oturumu açılıyor');
    try {
      const response = await fetch(`${apiUrl}/payments/stripe/checkout-session`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          analysisTicketId: ticket.id,
          successUrl,
          cancelUrl,
          currency,
          ...(coupon ? { couponCode: coupon.code } : {}),
        }),
      });
      if (!response.ok) {
        const message = await response.text();
        setStatus(`Stripe başarısız: ${message || response.status}`);
        return;
      }
      const body = (await response.json()) as StripeCheckoutSessionRecord;
      if (body.checkoutUrl) {
        window.location.assign(body.checkoutUrl);
      } else {
        setStatus('Stripe checkout URL boş döndü');
      }
    } catch {
      setStatus('Stripe API bağlantısı kurulamadı');
    } finally {
      setLoading(false);
    }
  }

  async function startPayPalCheckout() {
    if (!token || !ticket) return;
    setLoading(true);
    setStatus('PayPal siparişi oluşturuluyor');
    try {
      const response = await fetch(`${apiUrl}/payments/paypal/order`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          analysisTicketId: ticket.id,
          returnUrl: successUrl,
          cancelUrl,
          currency,
          ...(coupon ? { couponCode: coupon.code } : {}),
        }),
      });
      if (!response.ok) {
        const message = await response.text();
        setStatus(`PayPal başarısız: ${message || response.status}`);
        return;
      }
      const body = (await response.json()) as PayPalOrderRecord;
      if (body.approveUrl) {
        window.location.assign(body.approveUrl);
      } else {
        setStatus('PayPal approve URL boş döndü');
      }
    } catch {
      setStatus('PayPal API bağlantısı kurulamadı');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '32px auto', padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Ödeme — Ticket #{ticketId}</h1>
      <p style={{ color: '#555' }}>Para birimi: {currency} ({currencySource})</p>

      <section style={{ margin: '16px 0', padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
        <label style={{ display: 'block', marginBottom: 8 }}>JWT Token</label>
        <input
          type="text"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Bearer token"
          style={{ width: '100%', padding: 8, marginBottom: 8 }}
        />
        <button onClick={() => void loadTicket()} disabled={loading} type="button">
          Ticket Yükle
        </button>
      </section>

      {ticket && (
        <section style={{ margin: '16px 0', padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
          <h2>{ticket.title}</h2>
          <p>Ticket No: {ticket.ticketNumber}</p>
          <p>Durum: {ticket.status}</p>
          <p>Teklif: {ticket.quotePriceCents
            ? formatMoney(ticket.quotePriceCents, currency)
            : 'Henüz teklif yok'}</p>
        </section>
      )}

      {ticket && ticket.quotePriceCents ? (
        <>
          <section style={{ margin: '16px 0', padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
            <label style={{ display: 'block', marginBottom: 8 }}>Kupon Kodu</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                placeholder="ÖRN: STUDENT20"
                style={{ flex: 1, padding: 8 }}
              />
              <button onClick={() => void applyCoupon()} disabled={loading} type="button">
                Uygula
              </button>
            </div>
            {coupon && (
              <p style={{ marginTop: 8, color: '#0a7' }}>
                {coupon.name}: -{formatMoney(coupon.discountCents, currency)}
              </p>
            )}
          </section>

          <section style={{ margin: '16px 0', padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
            <p>Tutar: {formatMoney(baseAmountCents, currency)}</p>
            {discountCents > 0 && <p>İndirim: -{formatMoney(discountCents, currency)}</p>}
            <p style={{ fontWeight: 600 }}>
              Ödenecek: {formatMoney(finalAmountCents, currency)}
            </p>
          </section>

          <section style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => void startStripeCheckout()} disabled={loading} type="button">
              Stripe ile Öde
            </button>
            <button onClick={() => void startPayPalCheckout()} disabled={loading} type="button">
              PayPal ile Öde
            </button>
          </section>
        </>
      ) : null}

      <p style={{ marginTop: 24, padding: 12, background: '#f4f4f4', borderRadius: 6 }}>
        Durum: {status}
      </p>
    </main>
  );
}
