'use client';

import Link from 'next/link';
import { useTranslation } from '../_lib/i18n/useTranslation';

export default function HomePage() {
  const { t } = useTranslation();

  return (
    <>
      <main className="auth-shell" style={{ paddingTop: '80px' }}>
        <section className="hero glass-panel" style={{ textAlign: 'center', maxWidth: '800px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', marginBottom: '4rem' }}>
          <p className="eyebrow" style={{ marginTop: '0' }}>{t('home.hero_eyebrow')}</p>
          <h1 className="text-gradient" style={{ lineHeight: 1.1 }}>{t('home.hero_title')}</h1>
          <p className="copy" style={{ maxWidth: '600px', fontSize: '1.15rem' }}>
            {t('home.hero_copy')}
          </p>
          <div className="panel-actions" style={{ justifyContent: 'center', marginTop: '1.5rem', width: '100%' }}>
            <Link href="/register" className="btn-primary" style={{ textDecoration: 'none', width: 'auto' }}>
              {t('home.cta_primary')}
            </Link>
            <a href="#features" className="btn-secondary" style={{ textDecoration: 'none', width: 'auto' }}>
              {t('home.cta_secondary')}
            </a>
          </div>
        </section>

        <section id="features" style={{ display: 'grid', gap: '2rem', maxWidth: '1000px', width: '100%', gridTemplateColumns: 'minmax(0, 1fr)' }}>
          <h2 style={{ textAlign: 'center', fontSize: '2rem', marginBottom: '1rem' }}>{t('home.features_title')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🤖</div>
              <h3 style={{ fontSize: '1.3rem', margin: '0 0 1rem' }}>{t('home.feature_1_title')}</h3>
              <p style={{ color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>{t('home.feature_1_desc')}</p>
            </div>
            
            <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚡️</div>
              <h3 style={{ fontSize: '1.3rem', margin: '0 0 1rem' }}>{t('home.feature_2_title')}</h3>
              <p style={{ color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>{t('home.feature_2_desc')}</p>
            </div>

            <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📚</div>
              <h3 style={{ fontSize: '1.3rem', margin: '0 0 1rem' }}>{t('home.feature_3_title')}</h3>
              <p style={{ color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>{t('home.feature_3_desc')}</p>
            </div>
          </div>
        </section>
        
        {/* Development Shortcuts (Temporary link list from old index) */}
        <div style={{ marginTop: '5rem', padding: '1rem', borderTop: '1px solid var(--border)', width: '100%', maxWidth: '1000px', textAlign: 'center' }}>
          <p className="eyebrow">{t('home.dev_shortcuts')}</p>
          <div className="panel-actions" style={{ justifyContent: 'center' }}>
            <Link href="/admin/audit-logs">{t('home.shortcut_audit')}</Link>
            <Link href="/templates/workspace">{t('home.shortcut_workspace')}</Link>
            <Link href="/editor-lab">{t('home.shortcut_editor_lab')}</Link>
          </div>
        </div>
      </main>
    </>
  );
}
