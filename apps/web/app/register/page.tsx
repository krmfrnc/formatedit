'use client';

import Link from 'next/link';
import { useTranslation } from '../_lib/i18n/useTranslation';
import { Navbar } from '../_components/Navbar';
import { Footer } from '../_components/Footer';

export default function RegisterPage() {
  const { t } = useTranslation();

  return (
    <>
      <Navbar />
      <main className="auth-shell">
        <div className="auth-card glass-panel" style={{ marginTop: '4rem' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 className="text-gradient">{t('auth.register_title')}</h1>
            <p>{t('auth.register_subtitle')}</p>
          </div>

          <form className="security-form" onSubmit={(e) => e.preventDefault()}>
            <label>
              <span>Ad Soyad</span>
              <input type="text" placeholder="Dr. Akademisyen" required />
            </label>

            <label>
              <span>{t('auth.email')}</span>
              <input type="email" placeholder="ornek@universite.edu.tr" required />
            </label>
            
            <label>
              <span>{t('auth.password')}</span>
              <input type="password" placeholder="••••••••" required />
            </label>

            <button type="submit" className="btn-primary" style={{ marginTop: '1.5rem' }}>
              {t('auth.register_btn')}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
            <Link href="/login" style={{ fontSize: '0.9rem', color: 'var(--text)', textDecoration: 'none' }}>
              {t('auth.has_account')}
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
