'use client';

import { useState } from 'react';
import type { DocumentSecuritySettings } from '@formatedit/shared';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const initialState: DocumentSecuritySettings = {
  maxUploadSizeBytes: 10 * 1024 * 1024,
  clamAvEnabled: false,
  virusTotalEnabled: false,
};

export default function DocumentSecurityAdminPage() {
  const [token, setToken] = useState('');
  const [settings, setSettings] = useState<DocumentSecuritySettings>(initialState);
  const [status, setStatus] = useState('Hazir');

  async function loadSettings() {
    setStatus('Yukleniyor');
    try {
      const response = await fetch(`${apiUrl}/admin/document-security-settings`, {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        setStatus('Ayarlar yuklenemedi');
        return;
      }

      const body = (await response.json()) as DocumentSecuritySettings;
      setSettings(body);
      setStatus('Ayarlar yuklendi');
    } catch {
      setStatus('API baglantisi kurulamadi');
    }
  }

  async function saveSettings() {
    setStatus('Kaydediliyor');
    try {
      const response = await fetch(`${apiUrl}/admin/document-security-settings`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        setStatus('Kayit basarisiz');
        return;
      }

      const body = (await response.json()) as DocumentSecuritySettings;
      setSettings(body);
      setStatus('Ayarlar kaydedildi');
    } catch {
      setStatus('Kayit sirasinda baglanti hatasi');
    }
  }

  return (
    <main className="admin-shell">
      <section className="admin-hero">
        <p className="eyebrow">Document Security</p>
        <h1>Virus tarama ayarlari</h1>
        <p className="copy admin-copy">
          Admin bearer token ile belge yukleme limitini ve ClamAV ile VirusTotal taramalarini acip
          kapatabilirsiniz.
        </p>
      </section>

      <section className="audit-panel">
        <div className="security-form">
          <label>
            <span>Admin bearer token</span>
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Bearer token"
            />
          </label>

          <label>
            <span>Maksimum upload boyutu (byte)</span>
            <input
              type="number"
              value={settings.maxUploadSizeBytes}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  maxUploadSizeBytes: Number(event.target.value),
                }))
              }
            />
          </label>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.clamAvEnabled}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  clamAvEnabled: event.target.checked,
                }))
              }
            />
            <span>ClamAV taramasi aktif</span>
          </label>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settings.virusTotalEnabled}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  virusTotalEnabled: event.target.checked,
                }))
              }
            />
            <span>VirusTotal taramasi aktif</span>
          </label>

          <div className="panel-actions">
            <button
              type="button"
              onClick={() => {
                void loadSettings();
              }}
            >
              Ayarlari yukle
            </button>
            <button
              type="button"
              onClick={() => {
                void saveSettings();
              }}
            >
              Kaydet
            </button>
          </div>

          <p className="status-copy">Durum: {status}</p>
        </div>
      </section>
    </main>
  );
}
