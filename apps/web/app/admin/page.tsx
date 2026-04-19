import type { ReactNode } from 'react';
import { useAuth } from '../_lib/auth';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface AnalyticsSnapshot {
  window: { start: string; end: string };
  revenue: {
    grossCents: number;
    netCents: number;
    refundedCents: number;
    successfulPayments: number;
    failedPayments: number;
    arpu: number;
    byCurrency: Array<{ currency: string; grossCents: number; count: number }>;
  };
  operations: {
    ticketsCreated: number;
    ticketsClosed: number;
    ticketsOpen: number;
    averageCloseTimeHours: number | null;
    failedPaymentRate: number;
  };
  experts: Array<{ expertId: string; expertName: string | null; ticketsCompleted: number; averageRating: number | null }>;
  users: { totalUsers: number; newUsersInWindow: number; activeUsersInWindow: number; verifiedStudents: number };
}

async function getSnapshot(): Promise<AnalyticsSnapshot | null> {
  try {
    const { token } = await useAuth();
    const res = await fetch(`${apiUrl}/admin/analytics/snapshot`, {
      cache: 'no-store',
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    return (await res.json()) as AnalyticsSnapshot;
  } catch {
    return null;
  }
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function Stat({ label, value, subtitle }: { label: string; value: ReactNode; subtitle?: string }): ReactNode {
  return (
    <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
      <div style={{ color: 'var(--muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</div>
      <div className="text-gradient" style={{ fontSize: '2rem', fontWeight: 700, marginTop: '0.5rem', lineHeight: 1.1 }}>{value}</div>
      {subtitle ? <div style={{ fontSize: '0.85rem', color: 'var(--accent)', marginTop: '0.5rem', fontWeight: 500 }}>{subtitle}</div> : null}
    </div>
  );
}

export default async function AdminDashboardPage() {
  const snapshot = await getSnapshot();

  return (
    <div className="admin-shell" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '2rem', minHeight: '100vh', background: 'var(--admin-bg)' }}>
      <section className="glass-panel" style={{ padding: '3rem', borderRadius: '24px', display: 'flex', flexDirection: 'column' }}>
        <p className="eyebrow" style={{ color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.1em' }}>Admin Core</p>
        <h1 className="text-gradient" style={{ margin: 0, fontSize: '3.5rem', lineHeight: 1.1 }}>Executive Dashboard</h1>
        <p style={{ color: 'var(--muted)', marginTop: '1rem', fontSize: '1.15rem' }}>
          FormatEdit genel analiz, operasyonel zeka ve finansal raporlar (son 30 gün).
        </p>
      </section>

      {!snapshot ? (
        <div className="glass-panel" style={{ padding: '2rem', borderRadius: '24px', background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444' }}>
           <h3 style={{ margin: 0, color: '#ef4444' }}>Analytics Data Unavailable</h3>
           <p style={{ color: 'var(--muted)', marginTop: '0.5rem' }}>Veriler API'den alınamadı. Servis durumunu kontrol edin.</p>
        </div>
      ) : (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
            <Stat label="Net revenue" value={formatMoney(snapshot.revenue.netCents)} subtitle={`Gross ${formatMoney(snapshot.revenue.grossCents)}`} />
            <Stat label="Successful payments" value={snapshot.revenue.successfulPayments} />
            <Stat label="Failed payments" value={snapshot.revenue.failedPayments} />
            <Stat label="ARPU" value={formatMoney(snapshot.revenue.arpu)} />
            <Stat label="Active tickets" value={snapshot.operations.ticketsOpen} />
            <Stat label="Closed tickets" value={snapshot.operations.ticketsClosed} />
            <Stat
              label="Avg. close time"
              value={
                snapshot.operations.averageCloseTimeHours == null
                  ? '—'
                  : `${snapshot.operations.averageCloseTimeHours.toFixed(1)}h`
              }
            />
            <Stat label="Total users" value={snapshot.users.totalUsers} subtitle={`+${snapshot.users.newUsersInWindow} new`} />
            <Stat label="Verified students" value={snapshot.users.verifiedStudents} />
          </section>

          <section className="glass-panel" style={{ marginTop: '1.5rem', padding: '2rem', borderRadius: '24px' }}>
            <p className="eyebrow" style={{ margin: 0, marginBottom: '0.5rem', color: '#10b981' }}>Top Performers</p>
            <h2 style={{ margin: 0, marginBottom: '2rem', fontSize: '1.5rem' }}>Uzman Sıralaması</h2>
            {snapshot.experts.length === 0 ? (
              <p style={{ color: 'var(--muted)', padding: '2rem', textAlign: 'center', background: 'var(--admin-surface)', borderRadius: '12px' }}>Bu pencerede tamamlanan ticket yok.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '1rem', borderBottom: '2px solid var(--border)', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.05em' }}>Expert ID / İsim</th>
                      <th style={{ padding: '1rem', borderBottom: '2px solid var(--border)', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.05em' }}>Tamamlanan Ticket</th>
                      <th style={{ padding: '1rem', borderBottom: '2px solid var(--border)', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.05em' }}>Ort. Değerlendirme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.experts.slice(0, 10).map((e) => (
                      <tr key={e.expertId} style={{ borderBottom: '1px solid var(--border)', background: 'transparent', transition: 'background 0.2s' }}>
                        <td style={{ padding: '1.2rem 1rem', color: 'var(--text)', fontWeight: 500 }}>{e.expertName ?? e.expertId}</td>
                        <td style={{ padding: '1.2rem 1rem', color: '#34d399', fontWeight: 600 }}>{e.ticketsCompleted}</td>
                        <td style={{ padding: '1.2rem 1rem', color: 'var(--accent)' }}>{e.averageRating == null ? '—' : `⭐ ${e.averageRating.toFixed(2)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
