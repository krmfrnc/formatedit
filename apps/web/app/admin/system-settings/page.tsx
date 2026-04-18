'use client';

import { useState } from 'react';
import type {
  AdminSystemSettingsSnapshot,
  BackupSettings,
  DocumentSecuritySettings,
  SupportedLanguage,
} from '@formatedit/shared';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const defaultBackupDraft: BackupSettings = {
  cadence: 'DAILY',
  mode: 'FULL',
  retentionDays: 30,
};

const defaultDocumentSecurity: DocumentSecuritySettings = {
  maxUploadSizeBytes: 10 * 1024 * 1024,
  clamAvEnabled: false,
  virusTotalEnabled: false,
};

const defaultLanguages: SupportedLanguage[] = [
  { code: 'tr', label: 'Turkce' },
  { code: 'en', label: 'English' },
];

const quickLinks = [
  {
    href: '/admin/notifications',
    label: 'Notification channels',
    description: 'Email, WhatsApp, Telegram and in-app channel kill switches.',
  },
  {
    href: '/admin/audit-logs',
    label: 'Audit retention',
    description: 'Review retention policy and export activity logs.',
  },
  {
    href: '/admin/feature-flags',
    label: 'Feature flags',
    description: 'Runtime toggles and progressive rollout controls.',
  },
  {
    href: '/admin/legal',
    label: 'Legal documents',
    description: 'Manage privacy, KVKK, cookie and terms content.',
  },
];

export default function SystemSettingsPage() {
  const [token, setToken] = useState('');
  const [backupSettings, setBackupSettings] = useState<BackupSettings>(defaultBackupDraft);
  const [documentSecurity, setDocumentSecurity] =
    useState<DocumentSecuritySettings>(defaultDocumentSecurity);
  const [languages, setLanguages] = useState<SupportedLanguage[]>(defaultLanguages);
  const [backupConfigured, setBackupConfigured] = useState(false);
  const [status, setStatus] = useState('Hazir');

  async function loadSettings() {
    setStatus('Yukleniyor');
    try {
      const response = await fetch(`${apiUrl}/admin/system-settings`, {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        setStatus('Ayarlar yuklenemedi');
        return;
      }

      const body = (await response.json()) as AdminSystemSettingsSnapshot;
      if (body.backup) {
        setBackupSettings(body.backup);
        setBackupConfigured(true);
      } else {
        setBackupConfigured(false);
      }
      setLanguages(body.languages);
      setDocumentSecurity(body.documentSecurity);
      setStatus(body.backup ? 'Ayarlar yuklendi' : 'Backup ayarlari henuz tanimli degil');
    } catch {
      setStatus('API baglantisi kurulamadi');
    }
  }

  async function saveBackupSettings() {
    setStatus('Backup ayarlari kaydediliyor');
    try {
      const response = await fetch(`${apiUrl}/admin/system-settings/backup`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(backupSettings),
      });

      if (!response.ok) {
        setStatus('Backup ayarlari kaydedilemedi');
        return;
      }

      const body = (await response.json()) as BackupSettings;
      setBackupSettings(body);
      setBackupConfigured(true);
      setStatus('Backup ayarlari kaydedildi');
    } catch {
      setStatus('Backup kaydi sirasinda baglanti hatasi');
    }
  }

  async function saveDocumentSecuritySettings() {
    setStatus('Virus tarama ayarlari kaydediliyor');
    try {
      const response = await fetch(`${apiUrl}/admin/system-settings/document-security`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(documentSecurity),
      });

      if (!response.ok) {
        setStatus('Virus tarama ayarlari kaydedilemedi');
        return;
      }

      const body = (await response.json()) as DocumentSecuritySettings;
      setDocumentSecurity(body);
      setStatus('Virus tarama ayarlari kaydedildi');
    } catch {
      setStatus('Virus tarama kaydi sirasinda baglanti hatasi');
    }
  }

  async function saveLanguages() {
    setStatus('Dil ayarlari kaydediliyor');
    try {
      const response = await fetch(`${apiUrl}/admin/system-settings/languages`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ items: languages }),
      });

      if (!response.ok) {
        setStatus('Dil ayarlari kaydedilemedi');
        return;
      }

      const body = (await response.json()) as SupportedLanguage[];
      setLanguages(body);
      setStatus('Dil ayarlari kaydedildi');
    } catch {
      setStatus('Dil ayari kaydi sirasinda baglanti hatasi');
    }
  }

  return (
    <main className="admin-shell">
      <section className="admin-hero">
        <p className="eyebrow">System Settings</p>
        <h1>System settings</h1>
        <p className="copy admin-copy">
          Backup plani ve virus tarama ayarlarini tek ekranda yonetin. Diger platform capi
          kontroller icin hizli baglantilar altta yer aliyor.
        </p>
      </section>

      <section className="audit-panel">
        <div className="security-form" aria-describedby="system-settings-status">
          <label>
            <span>Admin bearer token</span>
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Bearer token"
            />
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
          </div>
          <p id="system-settings-status" className="status-copy" aria-live="polite">
            {status}
          </p>

          <section className="system-settings-group">
            <div>
              <h2>Backup ayarlari</h2>
              <p className="status-copy">
                {backupConfigured
                  ? 'Kayitli backup politikasi yuklendi.'
                  : 'Backup politikasi henuz kaydedilmemis. Secip kaydedebilirsiniz.'}
              </p>
            </div>

            <label>
              <span>Backup sikligi</span>
              <select
                value={backupSettings.cadence}
                onChange={(event) =>
                  setBackupSettings((current) => ({
                    ...current,
                    cadence: event.target.value as BackupSettings['cadence'],
                  }))
                }
              >
                <option value="DAILY">Gunluk</option>
                <option value="WEEKLY">Haftalik</option>
                <option value="MONTHLY">Aylik</option>
              </select>
            </label>

            <label>
              <span>Backup tipi</span>
              <select
                value={backupSettings.mode}
                onChange={(event) =>
                  setBackupSettings((current) => ({
                    ...current,
                    mode: event.target.value as BackupSettings['mode'],
                  }))
                }
              >
                <option value="FULL">Tam backup</option>
                <option value="INCREMENTAL">Incremental backup</option>
              </select>
            </label>

            <label>
              <span>Saklama suresi (gun)</span>
              <input
                type="number"
                min={1}
                value={backupSettings.retentionDays}
                onChange={(event) =>
                  setBackupSettings((current) => ({
                    ...current,
                    retentionDays: Number(event.target.value),
                  }))
                }
              />
            </label>

            <div className="panel-actions">
              <button
                type="button"
                onClick={() => {
                  void saveBackupSettings();
                }}
              >
                Backup ayarlarini kaydet
              </button>
            </div>
          </section>

          <section className="system-settings-group">
            <div>
              <h2>Dil yonetimi</h2>
              <p className="status-copy">
                Varsayilan diller Turkce ve English. Buradan yeni dil ekleyebilir veya mevcut
                listeyi duzenleyebilirsiniz.
              </p>
            </div>

            {languages.map((language, index) => (
              <div key={`${language.code}-${index}`} className="system-settings-language-row">
                <label>
                  <span>Dil kodu</span>
                  <input
                    type="text"
                    value={language.code}
                    onChange={(event) =>
                      setLanguages((current) =>
                        current.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, code: event.target.value } : entry,
                        ),
                      )
                    }
                  />
                </label>

                <label>
                  <span>Etiket</span>
                  <input
                    type="text"
                    value={language.label}
                    onChange={(event) =>
                      setLanguages((current) =>
                        current.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, label: event.target.value } : entry,
                        ),
                      )
                    }
                  />
                </label>

                <button
                  type="button"
                  onClick={() =>
                    setLanguages((current) => current.filter((_, entryIndex) => entryIndex !== index))
                  }
                  disabled={languages.length === 1}
                >
                  Kaldir
                </button>
              </div>
            ))}

            <div className="panel-actions">
              <button
                type="button"
                onClick={() =>
                  setLanguages((current) => [...current, { code: '', label: '' }])
                }
              >
                Dil ekle
              </button>
              <button
                type="button"
                onClick={() => {
                  void saveLanguages();
                }}
              >
                Dil ayarlarini kaydet
              </button>
            </div>
          </section>

          <section className="system-settings-group">
            <div>
              <h2>Virus tarama ayarlari</h2>
              <p className="status-copy">
                ClamAV ve VirusTotal kontrollerini bu ekrandan yonetebilirsiniz.
              </p>
            </div>

            <label>
              <span>Maksimum upload boyutu (byte)</span>
              <input
                type="number"
                min={1}
                value={documentSecurity.maxUploadSizeBytes}
                onChange={(event) =>
                  setDocumentSecurity((current) => ({
                    ...current,
                    maxUploadSizeBytes: Number(event.target.value),
                  }))
                }
              />
            </label>

            <label className="toggle-row">
              <input
                type="checkbox"
                checked={documentSecurity.clamAvEnabled}
                onChange={(event) =>
                  setDocumentSecurity((current) => ({
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
                checked={documentSecurity.virusTotalEnabled}
                onChange={(event) =>
                  setDocumentSecurity((current) => ({
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
                  void saveDocumentSecuritySettings();
                }}
              >
                Virus tarama ayarlarini kaydet
              </button>
            </div>
          </section>

          <p className="status-copy">Durum: {status}</p>
        </div>
      </section>

      <section className="audit-panel">
        <h2>Diger platform ayarlari</h2>
        <div className="system-settings-links">
          {quickLinks.map((item) => (
            <a key={item.href} href={item.href} className="system-settings-link-card">
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
