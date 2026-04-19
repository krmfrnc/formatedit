'use client';

import Link from 'next/link';
import { useTranslation } from '../_lib/i18n/useTranslation';
import { useLanguage } from '../_lib/i18n/LanguageContext';
import { useAuth } from '../_lib/auth-client';

export function Navbar() {
  const { t, language } = useTranslation();
  const { setLanguage } = useLanguage();

  let isAuthenticated = false;
  try {
    ({ isAuthenticated } = useAuth());
  } catch {
    isAuthenticated = false;
  }

  return (
    <nav className="nav-bar glass-panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <Link href="/" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text)', textDecoration: 'none' }}>
          FormatEdit
        </Link>
        <div className="nav-links">
          <Link href="/templates/workspace">{t('nav.templates')}</Link>
          {isAuthenticated ? <Link href="/admin">{t('nav.dashboard')}</Link> : null}
        </div>
      </div>

      <div className="nav-links" style={{ gap: '1rem' }}>
        <div className="lang-switch">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            aria-label="Dil Seçimi"
          >
            <option value="tr">TÜRKÇE</option>
            <option value="en">ENGLISH</option>
          </select>
        </div>
        {isAuthenticated ? (
          <Link href="/account" className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>
            {t('nav.account')}
          </Link>
        ) : (
          <>
            <Link href="/login" className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>
              {t('nav.login')}
            </Link>
            <Link href="/register" className="btn-primary" style={{ padding: '0.5rem 1rem' }}>
              {t('nav.register')}
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
