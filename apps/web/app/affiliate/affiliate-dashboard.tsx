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

  function headers(): HeadersInit {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }

  async function loadSummary() {
    if (!token) return setStatus('Önce JWT girin');
    setStatus('Yükleniyor');
    const response = await fetch(`${apiUrl}/affiliates/me`, { headers: headers() });
    if (response.status === 404) {
      setSummary(null);
      setStatus('Henüz affiliate değilsiniz. "Programa katıl" diyerek başlayın.');
      return;
    }
    if (!response.ok) {
      setStatus(`Hata: ${response.status}`);
      return;
    }
    const data = (await response.json()) as AffiliateSummary;
    setSummary(data);
    setStatus('Hazır');
  }

  async function enroll() {
    if (!token) return setStatus('Önce JWT girin');
    setStatus('Katılınıyor');
    const response = await fetch(`${apiUrl}/affiliates/me/enroll`, {
      method: 'POST',
      headers: headers(),
    });
    if (!response.ok) {
      setStatus(`Hata: ${response.status}`);
      return;
    }
    await loadSummary();
  }

  const shareUrl = summary ? `${appUrl}/?ref=${summary.affiliate.code}` : '';

  return (
    <main className="panel">
      <h1>Affiliate</h1>
      <p className="panel-status">{status}</p>
      <section className="panel-section">
        <label>
          JWT Token
          <input value={token} onChange={(event) => setToken(event.target.value)} />
        </label>
        <div className="panel-actions">
          <button type="button" onClick={() => void loadSummary()}>
            Özet yükle
          </button>
          <button type="button" onClick={() => void enroll()}>
            Programa katıl
          </button>
        </div>
      </section>

      {summary && (
        <>
          <section className="panel-section">
            <h2>Referans kodunuz</h2>
            <p>
              <strong>{summary.affiliate.code}</strong> · Komisyon: %
              {summary.affiliate.commissionPercent} · Durum: {summary.affiliate.status}
            </p>
            <p>Paylaşım linki: <code>{shareUrl}</code></p>
          </section>
          <section className="panel-section">
            <h2>İstatistik</h2>
            <ul className="panel-list">
              <li>Ziyaret: {summary.referralCount}</li>
              <li>Dönüşen kullanıcı: {summary.convertedCount}</li>
              <li>Toplam kazanç: {formatMoney(summary.earnedCents)}</li>
              <li>Bekleyen: {formatMoney(summary.pendingCents)}</li>
              <li>Ödenen: {formatMoney(summary.paidCents)}</li>
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
