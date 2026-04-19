import Link from 'next/link';

export default function TemplateWorkspacePage() {
  return (
    <main className="premium-main" style={{ display: 'flex', flexDirection: 'column', gap: '3rem', padding: 'calc(var(--nav-height) + 2rem) 2rem 4rem', minHeight: '100vh', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Hero Section */}
      <section className="glass-panel" style={{ padding: '4rem 2rem', borderRadius: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-50%', left: '-20%', width: '100%', height: '200%', background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 60%)', zIndex: 0, pointerEvents: 'none' }}></div>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p className="eyebrow" style={{ color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.15em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🗂️</span> Workspace
          </p>
          <h1 className="text-gradient" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', marginTop: '0', marginBottom: '1.5rem', lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.03em' }}>
            Şablon Akış Merkezi
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '1.2rem', maxWidth: '650px', margin: '0 auto 2.5rem', lineHeight: 1.6 }}>
            Kişisel akademik şablonlarınızı yönetin, yepyeni taslaklar oluşturun ya da kurumsal şablon havuzuna erişim sağlayın.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href="/templates/wizard" className="btn-glow-large" style={{ padding: '0.8rem 2rem', fontSize: '1rem' }}>
              + Yeni Şablon
            </Link>
            <Link href="/templates/me" className="btn-glass-large" style={{ padding: '0.8rem 2rem', fontSize: '1rem' }}>
              Kayıtlı Şablonlarım
            </Link>
          </div>
        </div>
      </section>

      {/* Grid Features */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        
        {/* Create Card */}
        <article className="glass-panel" style={{ padding: '3rem 2.5rem', borderRadius: '24px', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(90deg, #f59e0b, #d97706)' }}></div>
          <div style={{ width: '56px', height: '56px', background: 'rgba(217, 119, 6, 0.1)', borderRadius: '16px', display: 'grid', placeItems: 'center', marginBottom: '2rem', color: '#f59e0b', fontSize: '1.8rem', boxShadow: '0 8px 16px rgba(245, 158, 11, 0.1)' }}>✨</div>
          <h2 style={{ fontSize: '1.5rem', margin: '0 0 1rem', fontWeight: 700, color: 'var(--text)' }}>Sıfırdan Başla</h2>
          <p style={{ color: 'var(--muted)', marginBottom: '2.5rem', flex: 1, lineHeight: 1.6, fontSize: '1.05rem' }}>
            11 adımlı interaktif sihirbaz ile formatlamayı saniyeler içinde tamamlayarak, yeni çalışmanızı hazırlayın.
          </p>
          <div style={{ marginTop: 'auto' }}>
            <Link href="/templates/wizard" style={{ fontWeight: 600, color: '#f59e0b', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', transition: 'gap 0.2s' }} className="hover-arrow">
              Sihirbazı Aç <span style={{ transition: 'transform 0.2s' }}>→</span>
            </Link>
          </div>
        </article>

        {/* Manage Card */}
        <article className="glass-panel" style={{ padding: '3rem 2.5rem', borderRadius: '24px', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(90deg, #10b981, #059669)' }}></div>
          <div style={{ width: '56px', height: '56px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '16px', display: 'grid', placeItems: 'center', marginBottom: '2rem', color: '#10b981', fontSize: '1.8rem', boxShadow: '0 8px 16px rgba(16, 185, 129, 0.1)' }}>📂</div>
          <h2 style={{ fontSize: '1.5rem', margin: '0 0 1rem', fontWeight: 700, color: 'var(--text)' }}>Şablonları Düzenle</h2>
          <p style={{ color: 'var(--muted)', marginBottom: '2.5rem', flex: 1, lineHeight: 1.6, fontSize: '1.05rem' }}>
            Önceden hazırladığınız kişisel şablonları açın, güncelleyin ve her an kolayca export mekanizması ile PDF'e dönüştürün.
          </p>
          <div style={{ marginTop: 'auto' }}>
            <Link href="/templates/me" style={{ fontWeight: 600, color: '#10b981', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', transition: 'gap 0.2s' }} className="hover-arrow">
              Yönetim Ekranı <span style={{ transition: 'transform 0.2s' }}>→</span>
            </Link>
          </div>
        </article>

        {/* Admin Card */}
        <article className="glass-panel" style={{ padding: '3rem 2.5rem', borderRadius: '24px', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(90deg, #6366f1, #4f46e5)' }}></div>
          <div style={{ width: '56px', height: '56px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '16px', display: 'grid', placeItems: 'center', marginBottom: '2rem', color: '#6366f1', fontSize: '1.8rem', boxShadow: '0 8px 16px rgba(99, 102, 241, 0.1)' }}>⚙️</div>
          <h2 style={{ fontSize: '1.5rem', margin: '0 0 1rem', fontWeight: 700, color: 'var(--text)' }}>Stüdyo Erişimi</h2>
          <p style={{ color: 'var(--muted)', marginBottom: '2.5rem', flex: 1, lineHeight: 1.6, fontSize: '1.05rem' }}>
            Gelişmiş kontrol paneli ile kurumsal şablon yönetimi yapın, public havuzu besleyin ve veri ithal/ihraç işlerini yürütün.
          </p>
          <div style={{ marginTop: 'auto' }}>
            <Link href="/admin/templates" style={{ fontWeight: 600, color: '#6366f1', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', transition: 'gap 0.2s' }} className="hover-arrow">
              Admin Stüdyosu <span style={{ transition: 'transform 0.2s' }}>→</span>
            </Link>
          </div>
        </article>
      </section>

      <style>{`
        article:hover {
          transform: translateY(-8px);
          box-shadow: 0 30px 60px rgba(0,0,0,0.08), 0 0 0 1px rgba(255,255,255,0.4) inset !important;
        }
        :root[data-theme='dark'] article:hover {
          box-shadow: 0 30px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1) inset !important;
        }
        .hover-arrow:hover span {
          transform: translateX(4px);
        }
      `}</style>
    </main>
  );
}
