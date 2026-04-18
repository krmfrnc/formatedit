'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  GeoCurrencyResolution,
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
}

const planOptions: PlanOption[] = [
  { planCode: 'PRO_MONTHLY', label: 'Pro Aylık', interval: 'MONTH', priceCents: 1900 },
  { planCode: 'PRO_YEARLY', label: 'Pro Yıllık', interval: 'YEAR', priceCents: 18000 },
];

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
  const [token, setToken] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>(planOptions[0].planCode);
  const [status, setStatus] = useState('Hazır');
  const [loading, setLoading] = useState(false);

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
      // fall back
    }
  }

  async function loadSubscriptions() {
    if (!token) {
      setStatus('Önce JWT token girin');
      return;
    }
    setLoading(true);
    setStatus('Abonelikler yükleniyor');
    try {
      const response = await fetch(`${apiUrl}/payments/subscriptions/me`, {
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!response.ok) {
        setStatus(`Abonelikler alınamadı (${response.status})`);
        return;
      }
      const body = (await response.json()) as SubscriptionRecord[];
      setSubscriptions(body);
      setStatus(`${body.length} abonelik bulundu`);
    } catch {
      setStatus('API bağlantısı kurulamadı');
    } finally {
      setLoading(false);
    }
  }

  async function startSubscription() {
    if (!token) {
      setStatus('Önce JWT token girin');
      return;
    }
    setLoading(true);
    setStatus('Stripe abonelik oturumu açılıyor');
    try {
      const response = await fetch(
        `${apiUrl}/payments/stripe/subscription-checkout-session`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            planCode: selectedOption.planCode,
            interval: selectedOption.interval,
            priceCents: selectedOption.priceCents,
            currency,
            successUrl,
            cancelUrl,
          }),
        },
      );
      if (!response.ok) {
        const message = await response.text();
        setStatus(`Stripe başarısız: ${message || response.status}`);
        return;
      }
      const body = (await response.json()) as StripeSubscriptionCheckoutSessionRecord;
      if (body.checkoutUrl) {
        window.location.assign(body.checkoutUrl);
      } else {
        setStatus('Checkout URL boş döndü');
      }
    } catch {
      setStatus('Stripe API bağlantısı kurulamadı');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: '32px auto', padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Abonelikler</h1>
      <p style={{ color: '#555' }}>Para birimi: {currency}</p>

      <section style={{ margin: '16px 0', padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
        <label style={{ display: 'block', marginBottom: 8 }}>JWT Token</label>
        <input
          type="text"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Bearer token"
          style={{ width: '100%', padding: 8, marginBottom: 8 }}
        />
        <button onClick={() => void loadSubscriptions()} disabled={loading} type="button">
          Aboneliklerimi Yükle
        </button>
      </section>

      <section style={{ margin: '16px 0', padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
        <h2>Mevcut Abonelikler</h2>
        {subscriptions.length === 0 ? (
          <p style={{ color: '#777' }}>Henüz abonelik yok.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                <th style={{ padding: 6 }}>Plan</th>
                <th style={{ padding: 6 }}>Durum</th>
                <th style={{ padding: 6 }}>Aralık</th>
                <th style={{ padding: 6 }}>Fiyat</th>
                <th style={{ padding: 6 }}>Dönem Sonu</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((subscription) => (
                <tr key={subscription.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 6 }}>{subscription.planCode}</td>
                  <td style={{ padding: 6 }}>{subscription.status}</td>
                  <td style={{ padding: 6 }}>{subscription.interval}</td>
                  <td style={{ padding: 6 }}>
                    {formatMoney(subscription.priceCents, subscription.currency)}
                  </td>
                  <td style={{ padding: 6 }}>{formatDate(subscription.currentPeriodEnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ margin: '16px 0', padding: 16, border: '1px solid #ddd', borderRadius: 8 }}>
        <h2>Yeni Abonelik Başlat</h2>
        <label style={{ display: 'block', marginBottom: 8 }}>Plan</label>
        <select
          value={selectedPlan}
          onChange={(event) => setSelectedPlan(event.target.value)}
          style={{ width: '100%', padding: 8, marginBottom: 12 }}
        >
          {planOptions.map((option) => (
            <option key={option.planCode} value={option.planCode}>
              {option.label} — {formatMoney(option.priceCents, currency)} / {option.interval}
            </option>
          ))}
        </select>
        <button onClick={() => void startSubscription()} disabled={loading} type="button">
          Stripe ile Abone Ol
        </button>
      </section>

      <p style={{ marginTop: 24, padding: 12, background: '#f4f4f4', borderRadius: 6 }}>
        Durum: {status}
      </p>
    </main>
  );
}
