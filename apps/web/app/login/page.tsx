'use client';

import Link from 'next/link';
import { useTranslation } from '../_lib/i18n/useTranslation';
import { Navbar } from '../_components/Navbar';
import { Footer } from '../_components/Footer';

export default function LoginPage() {
  const { t } = useTranslation();

  return (
    <>
      <Navbar />
      <main className="auth-shell">
        <div className="auth-card glass-panel" style={{ marginTop: '4rem' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 className="text-gradient">{t('auth.login_title')}</h1>
            <p>{t('auth.login_subtitle')}</p>
          </div>

          <form className="security-form" onSubmit={(e) => e.preventDefault()}>
            <label>
              <span>{t('auth.email')}</span>
              <input type="email" placeholder="ornek@universite.edu.tr" required />
            </label>
            
            <label>
              <span>{t('auth.password')}</span>
              <input type="password" placeholder="••••••••" required />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Link href="#" style={{ fontSize: '0.85rem', color: 'var(--accent)', textDecoration: 'none' }}>
                {t('auth.forgot_pass')}
              </Link>
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>
              {t('auth.login_btn')}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
            <Link href="/register" style={{ fontSize: '0.9rem', color: 'var(--text)', textDecoration: 'none' }}>
              {t('auth.no_account')}
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
