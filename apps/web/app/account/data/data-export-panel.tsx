'use client';

import { useState } from 'react';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function DataExportPanel() {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState('Hazır');

  async function download() {
    if (!token) return setStatus('Önce JWT girin');
    setStatus('Veriler hazırlanıyor');
    const response = await fetch(`${apiUrl}/users/me/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      setStatus(`Hata: ${response.status}`);
      return;
    }
    const payload = (await response.json()) as unknown;
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `formatedit-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setStatus('İndirme başladı');
  }

  async function deleteAccount() {
    if (!token) return setStatus('Önce JWT girin');
    if (!confirm('Hesabınız anonimleştirilecek. Devam edilsin mi?')) return;
    setStatus('İşleniyor');
    const response = await fetch(`${apiUrl}/users/me`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      setStatus(`Hata: ${response.status}`);
      return;
    }
    setStatus('Hesabınız anonimleştirildi. Çıkış yapabilirsiniz.');
  }

  return (
    <main className="panel">
      <h1>Hesap verilerim</h1>
      <p className="panel-status">{status}</p>
      <section className="panel-section">
        <p>
          KVKK / GDPR uyarınca hesabınıza ait tüm verilerin JSON dökümünü indirebilir veya
          hesabınızı anonimleştirebilirsiniz.
        </p>
        <label>
          JWT Token
          <input value={token} onChange={(event) => setToken(event.target.value)} />
        </label>
        <div className="panel-actions">
          <button type="button" onClick={() => void download()}>
            Verilerimi indir (JSON)
          </button>
          <button type="button" onClick={() => void deleteAccount()}>
            Hesabımı sil
          </button>
        </div>
      </section>
    </main>
  );
}
