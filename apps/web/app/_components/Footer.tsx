'use client';

import Link from 'next/link';
import { useTranslation } from '../_lib/i18n/useTranslation';

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="footer">
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/privacy">{t('footer.privacy')}</Link>
        <Link href="/terms">{t('footer.terms')}</Link>
        <Link href="/cookies">{t('footer.cookies')}</Link>
      </div>
      <p>© {new Date().getFullYear()} FormatEdit. {t('footer.rights')}</p>
    </footer>
  );
}
