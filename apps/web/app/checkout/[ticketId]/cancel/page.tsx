import Link from 'next/link';

export default function CheckoutCancelPage() {
  return (
    <main className="admin-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
      <div className="glass-panel" style={{ padding: '4rem', borderRadius: '32px', textAlign: 'center', maxWidth: '500px', width: '100%' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>⚠️</div>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem', color: '#f59e0b' }}>Ödeme İptal Edildi</h1>
        <p style={{ color: 'var(--muted)', fontSize: '1.05rem', lineHeight: 1.6, marginBottom: '2rem' }}>
          Ödeme işlemi tamamlanmadı. İsterseniz tekrar deneyebilirsiniz — talebiniz hâlâ açık durumda bekliyor.
        </p>
        <Link
          href="/support"
          style={{
            display: 'inline-block',
            padding: '0.8rem 2rem',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.1)',
            color: 'var(--text)',
            fontWeight: 600,
            textDecoration: 'none',
            border: '1px solid var(--border)',
            transition: 'all 0.2s',
          }}
        >
          ← Taleplerime Dön
        </Link>
      </div>
    </main>
  );
}
