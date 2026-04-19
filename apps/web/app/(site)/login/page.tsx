'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from '../../_lib/i18n/useTranslation';
import { useAuthContext } from '../../_lib/AuthContext';

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuthContext();
  const redirect = searchParams?.get('redirect') ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <main className="auth-shell">
      <div className="auth-card glass-panel" style={{ marginTop: '4rem' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 className="text-gradient">{t('auth.login_title')}</h1>
          <p>{t('auth.login_subtitle')}</p>
        </div>

        <form
          className="security-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setSubmitting(true);
            try {
              await login(email, password);
              router.push(redirect);
            } catch {
              setError(t('common.error'));
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <label>
            <span>{t('auth.email')}</span>
            <input
              type="email"
              placeholder="ornek@universite.edu.tr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label>
            <span>{t('auth.password')}</span>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Link href="#" style={{ fontSize: '0.85rem', color: 'var(--accent)', textDecoration: 'none' }}>
              {t('auth.forgot_pass')}
            </Link>
          </div>

          {error && (
            <p role="alert" style={{ color: '#ef4444', margin: 0, fontSize: '0.9rem' }}>
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }} disabled={submitting}>
            {submitting ? t('common.loading') : t('auth.login_btn')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
          <Link
            href={redirect && redirect !== '/' ? `/register?redirect=${encodeURIComponent(redirect)}` : '/register'}
            style={{ fontSize: '0.9rem', color: 'var(--text)', textDecoration: 'none' }}
          >
            {t('auth.no_account')}
          </Link>
        </div>
      </div>
    </main>
  );
}
