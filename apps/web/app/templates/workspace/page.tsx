import Link from 'next/link';

export default function TemplateWorkspacePage() {
  return (
    <main className="admin-shell" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '2rem', minHeight: '100vh' }}>
      <section className="glass-panel" style={{ padding: '3rem', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <p className="eyebrow" style={{ color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.1em' }}>Template Workspace</p>
        <h1 className="text-gradient" style={{ fontSize: '3.5rem', marginTop: '0.5rem', marginBottom: '1rem', lineHeight: 1.1 }}>
          Şablon Akış Merkezi
        </h1>
        <p className="copy admin-copy" style={{ color: 'var(--muted)', fontSize: '1.15rem', maxWidth: '600px', margin: '0 auto', marginBottom: '2rem' }}>
          Yeni bir kişisel akademik şablon oluşturmak, mevcut tez biçimlerinizi düzenlemek veya direkt olarak gelişmiş admin stüdyosuna geçiş yapmak için bu merkezi istasyonu kullanın.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/templates/wizard" className="btn-primary" style={{ padding: '0.8rem 2rem', textDecoration: 'none' }}>Yeni Şablon Sihirbazı</Link>
          <Link href="/templates/me" className="btn-secondary" style={{ padding: '0.8rem 2rem', textDecoration: 'none' }}>Kişisel Şablonlarım</Link>
          <Link href="/admin/templates" className="btn-secondary" style={{ padding: '0.8rem 2rem', textDecoration: 'none' }}>Admin Studio</Link>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        <article className="glass-panel hover-card" style={{ padding: '2.5rem', borderRadius: '24px', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ width: '48px', height: '48px', background: 'rgba(217, 119, 6, 0.1)', borderRadius: '12px', display: 'grid', placeItems: 'center', marginBottom: '1.5rem', color: 'var(--accent)', fontSize: '1.5rem' }}>✨</div>
          <p className="eyebrow" style={{ margin: 0, marginBottom: '0.5rem' }}>Create</p>
          <h2 style={{ fontSize: '1.4rem', margin: 0, marginBottom: '1rem' }}>Sıfırdan veya Baz Şablonla Başla</h2>
          <p className="copy" style={{ color: 'var(--muted)', marginBottom: '2rem', flex: 1 }}>
            11 adımlı interaktif sihirbaz ile resmi bir akademik formatı temel alıp kendi kişisel sürümünüzü oluşturun.
          </p>
          <div className="panel-actions">
            <Link href="/templates/wizard" className="text-gradient" style={{ fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Sihirbazı Aç →
            </Link>
          </div>
        </article>

        <article className="glass-panel hover-card" style={{ padding: '2.5rem', borderRadius: '24px', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ width: '48px', height: '48px', background: 'rgba(52, 211, 153, 0.1)', borderRadius: '12px', display: 'grid', placeItems: 'center', marginBottom: '1.5rem', color: '#34d399', fontSize: '1.5rem' }}>📂</div>
          <p className="eyebrow" style={{ margin: 0, marginBottom: '0.5rem' }}>Manage</p>
          <h2 style={{ fontSize: '1.4rem', margin: 0, marginBottom: '1rem' }}>Kayıtlı Şablonları Düzenle</h2>
          <p className="copy" style={{ color: 'var(--muted)', marginBottom: '2rem', flex: 1 }}>
            Daha önce oluşturduğunuz kişisel şablonları açın, JSON mantığı ile güncelleyin ve gerektiğinde arşive taşıyın.
          </p>
          <div className="panel-actions">
            <Link href="/templates/me" className="text-gradient" style={{ fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Yönetim Ekranı →
            </Link>
          </div>
        </article>

        <article className="glass-panel hover-card" style={{ padding: '2.5rem', borderRadius: '24px', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', cursor: 'pointer', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ width: '48px', height: '48px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', display: 'grid', placeItems: 'center', marginBottom: '1.5rem', color: '#6366f1', fontSize: '1.5rem' }}>⚙️</div>
          <p className="eyebrow" style={{ margin: 0, marginBottom: '0.5rem' }}>Admin</p>
          <h2 style={{ fontSize: '1.4rem', margin: 0, marginBottom: '1rem' }}>Promote, Import ve Export</h2>
          <p className="copy" style={{ color: 'var(--muted)', marginBottom: '2rem', flex: 1 }}>
            Gelişmiş kontrol panelinde topluluk şablonlarını resmiye taşıyın, JSON bundle import edin ve istatistikleri görünür tutun.
          </p>
          <div className="panel-actions">
            <Link href="/admin/templates" className="text-gradient" style={{ fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Stüdyoya Git →
            </Link>
          </div>
        </article>
      </section>
      <style>{`
        .hover-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.2) !important;
          border-color: rgba(217, 119, 6, 0.4) !important;
        }
      `}</style>
    </main>
  );
}
