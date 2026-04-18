'use client';

import React from 'react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type ConsentState = 'accepted' | 'essential-only' | null;

const STORAGE_KEY = 'formatedit-cookie-consent';

export function CookieConsentBanner() {
  const [consent, setConsent] = useState<ConsentState>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'accepted' || stored === 'essential-only') {
      setConsent(stored);
    }
  }, []);

  function persist(nextConsent: Exclude<ConsentState, null>) {
    window.localStorage.setItem(STORAGE_KEY, nextConsent);
    setConsent(nextConsent);
  }

  if (!mounted || consent) {
    return null;
  }

  return (
    <aside className="cookie-banner" aria-label="Cookie consent banner">
      <div className="cookie-banner__copy">
        <strong>Cerez tercihleri</strong>
        <p>
          Platformun guvenli calismasi icin zorunlu cerezler kullanilir. Analitik ve
          tercih cerezleri icin onayinizi aliyoruz. Ayrintilar icin{' '}
          <Link href="/cookies">cerez politikasi</Link> ve{' '}
          <Link href="/privacy">gizlilik politikasi</Link> sayfalarina bakabilirsiniz.
        </p>
      </div>
      <div className="panel-actions">
        <button type="button" onClick={() => persist('essential-only')}>
          Sadece zorunlu
        </button>
        <button type="button" onClick={() => persist('accepted')}>
          Tumunu kabul et
        </button>
      </div>
    </aside>
  );
}
