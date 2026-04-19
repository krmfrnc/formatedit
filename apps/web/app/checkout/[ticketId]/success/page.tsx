import Link from 'next/link';

export default function CheckoutSuccessPage() {
  return (
    <main className="admin-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
      <div className="glass-panel" style={{ padding: '4rem', borderRadius: '32px', textAlign: 'center', maxWidth: '500px', width: '100%' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>✅</div>
        <h1 className="text-gradient" style={{ fontSize: '2rem', marginBottom: '1rem' }}>Ödeme Başarılı!</h1>
        <p style={{ color: 'var(--muted)', fontSize: '1.05rem', lineHeight: 1.6, marginBottom: '2rem' }}>
          Ödemeniz başarıyla alındı. Sağlayıcı onayı tamamlandığında talebinizin durumu otomatik olarak güncellenecektir.
        </p>
        <Link
          href="/support"
          style={{
            display: 'inline-block',
            padding: '0.8rem 2rem',
            borderRadius: '12px',
            background: 'var(--accent)',
            color: '#fff',
            fontWeight: 600,
            textDecoration: 'none',
            transition: 'opacity 0.2s',
          }}
        >
          Taleplerime Dön →
        </Link>
      </div>
    </main>
  );
}
