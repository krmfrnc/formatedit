import type { ReactNode } from 'react';
import Link from 'next/link';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" style={{ fontSize: '1.2rem', fontWeight: 800, textDecoration: 'none', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'var(--accent)', display: 'inline-block' }}></span>
            FormatEdit
          </Link>
          <nav style={{ display: 'flex', gap: '1.5rem' }}>
            <Link href="/legal/terms" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500, transition: 'color 0.2s' }}>Kullanım Koşulları</Link>
            <Link href="/legal/privacy" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500, transition: 'color 0.2s' }}>Gizlilik Politikası</Link>
          </nav>
        </div>
      </header>

      <main style={{ flex: 1, padding: '4rem 2rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {children}
        </div>
      </main>

      <footer style={{ padding: '2rem', borderTop: '1px solid var(--border)', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
        <p>© {new Date().getFullYear()} FormatEdit. Tüm hakları saklıdır.</p>
      </footer>
    </div>
  );
}
