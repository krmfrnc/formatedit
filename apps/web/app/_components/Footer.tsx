'use client';

import Link from 'next/link';
import { useTranslation } from '../_lib/i18n/useTranslation';

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="premium-footer">
      <div className="footer-glow-effect"></div>
      <div className="footer-content">
        <div className="footer-brand">
          <Link href="/" className="brand-logo">
            <span className="brand-icon">✧</span>
            <span className="brand-text">FormatEdit</span>
          </Link>
          <p className="footer-tagline">
            Akademik formatlama ve analiz süreçlerinizi yapay zeka ile hızlandırın.
          </p>
        </div>
        
        <div className="footer-links-grid">
          <div className="footer-col">
            <h3>Ürün</h3>
            <Link href="/features">Özellikler</Link>
            <Link href="/pricing">Fiyatlandırma</Link>
            <Link href="/templates/workspace">Şablonlar</Link>
          </div>
          
          <div className="footer-col">
            <h3>Destek</h3>
            <Link href="/support">Yardım Merkezi</Link>
            <Link href="/contact">İletişim</Link>
            <Link href="/status">Sistem Durumu</Link>
          </div>
          
          <div className="footer-col">
            <h3>Yasal</h3>
            <Link href="/legal/privacy">{t('footer.privacy')}</Link>
            <Link href="/legal/terms">{t('footer.terms')}</Link>
            <Link href="/legal/cookies">{t('footer.cookies')}</Link>
          </div>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} FormatEdit. {t('footer.rights')}</p>
        <div className="footer-social">
          <a href="#" aria-label="Twitter">𝕏</a>
          <a href="#" aria-label="LinkedIn">in</a>
          <a href="#" aria-label="GitHub">gh</a>
        </div>
      </div>
    </footer>
  );
}
