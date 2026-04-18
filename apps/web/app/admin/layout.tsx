import Link from 'next/link';
import type { Route } from 'next';
import type { ReactNode } from 'react';
import { ThemeToggle } from '../_components/theme-toggle';
import { AdminNav } from './admin-nav';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#admin-main-content" className="skip-link">
        Skip to admin content
      </a>
      <div className="admin-shell">
        <aside className="admin-shell__sidebar glass-panel">
          <div className="admin-shell__brand">
            <Link href={{ pathname: '/admin' } as { pathname: Route }} className="text-gradient">
              FormatEdit Admin
            </Link>
          </div>
          <ThemeToggle />
          <AdminNav />
        </aside>
        
        <div className="admin-shell__wrapper">
          <header className="admin-shell__header glass-panel">
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span style={{ fontSize: '1.25rem', cursor: 'pointer' }}>🔔</span>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 'bold' }}>A</div>
              </div>
            </div>
          </header>
          
          <main id="admin-main-content" className="admin-shell__content" tabIndex={-1}>
            <div className="admin-content-inner">
              {children}
            </div>
          </main>
        </div>
      </div>
      
      <style>{`
        .admin-shell { 
          display: grid; 
          grid-template-columns: 280px 1fr; 
          min-height: 100vh;
          background: radial-gradient(circle at top left, rgba(166, 75, 42, 0.08), transparent 50%),
                      radial-gradient(circle at bottom right, rgba(217, 119, 6, 0.05), transparent 50%);
        }
        
        .admin-shell__sidebar {
          padding: 24px 16px;
          border-right: 1px solid var(--admin-border);
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          border-radius: 0;
          border-top: none;
          border-bottom: none;
          border-left: none;
        }
        
        .admin-shell__brand a {
          font-weight: 800;
          font-size: 20px;
          text-decoration: none;
          letter-spacing: -0.02em;
        }
        
        .admin-shell__section { margin-top: 8px; }
        .admin-shell__section h3 {
          color: var(--admin-sidebar-muted);
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin: 0 0 12px 10px;
          font-weight: 600;
        }
        
        .admin-shell__section ul { list-style: none; padding: 0; margin: 0; }
        .admin-shell__section li { margin: 4px 0; }
        .admin-shell__section a {
          display: flex;
          align-items: center;
          padding: 10px 14px;
          color: var(--admin-sidebar-link);
          text-decoration: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .admin-shell__section a:hover {
          background: rgba(166, 75, 42, 0.08);
          transform: translateX(4px);
        }
        
        .admin-shell__section a[aria-current='page'] {
          background: linear-gradient(135deg, rgba(166, 75, 42, 0.15) 0%, rgba(217, 119, 6, 0.1) 100%);
          color: var(--accent);
          font-weight: 600;
          border-left: 3px solid var(--accent);
          border-top-left-radius: 4px;
          border-bottom-left-radius: 4px;
        }

        .admin-shell__wrapper {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          overflow-x: hidden;
        }

        .admin-shell__header {
          height: 72px;
          padding: 0 32px;
          display: flex;
          align-items: center;
          border-bottom: 1px solid var(--admin-border);
          position: sticky;
          top: 0;
          z-index: 10;
          border-radius: 0;
          border-left: none;
          border-right: none;
          border-top: none;
        }
        
        .admin-shell__content {
          padding: 32px;
          flex: 1;
        }

        .admin-content-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }
        
        @media (max-width: 960px) {
          .admin-shell { grid-template-columns: 1fr; }
          .admin-shell__sidebar { position: static; height: auto; }
          .admin-shell__header { display: none; }
        }
      `}</style>
    </>
  );
}
