import Link from 'next/link';
import type { AuditLogRecord, AuditRetentionPolicy } from '@formatedit/shared';
import { useAuth } from '../../_lib/auth';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function getAuditSnapshot(): Promise<{
  logs: AuditLogRecord[];
  retention: AuditRetentionPolicy | null;
  reachable: boolean;
}> {
  try {
    const { token } = await useAuth();
    const authHeader = token ? { authorization: `Bearer ${token}` } : {};
    const [logsResponse, retentionResponse] = await Promise.all([
      fetch(`${apiUrl}/admin/audit-logs?limit=10`, {
        cache: 'no-store',
        headers: authHeader,
      }),
      fetch(`${apiUrl}/admin/audit-logs/retention`, {
        cache: 'no-store',
        headers: authHeader,
      }),
    ]);

    if (!logsResponse.ok || !retentionResponse.ok) {
      return { logs: [], retention: null, reachable: false };
    }

    return {
      logs: (await logsResponse.json()) as AuditLogRecord[],
      retention: (await retentionResponse.json()) as AuditRetentionPolicy,
      reachable: true,
    };
  } catch {
    return { logs: [], retention: null, reachable: false };
  }
}

export default async function AuditLogsAdminPage() {
  const snapshot = await getAuditSnapshot();

  return (
    <main className="admin-shell" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '2rem', minHeight: '100vh', background: 'var(--admin-bg)' }}>
      <section className="glass-panel" style={{ padding: '3rem', borderRadius: '24px', position: 'relative', overflow: 'hidden' }}>
        <p className="eyebrow" style={{ color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.1em' }}>Admin Audit</p>
        <h1 className="text-gradient" style={{ margin: '0.5rem 0 1rem', fontSize: '3.5rem', lineHeight: 1.1 }}>Audit Log Merkezi</h1>
        <p className="copy admin-copy" style={{ color: 'var(--muted)', fontSize: '1.15rem', maxWidth: '700px' }}>
          Kritik auth ve profil hareketleri tek panelde toplanır. Export, retention ve son olaylar bu yüzeyden izlenir.
        </p>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
        <article className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>API Bağlantısı</span>
          <strong className="text-gradient" style={{ fontSize: '2rem', marginTop: '0.5rem', color: snapshot.reachable ? '#10b981' : '#ef4444' }}>{snapshot.reachable ? 'Hazır' : 'Bağlanamadı'}</strong>
        </article>
        <article className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Retention Policy</span>
          <strong style={{ fontSize: '1.5rem', marginTop: '0.8rem', color: 'var(--text)' }}>
            {snapshot.retention
              ? `${snapshot.retention.retentionDays} gün / ${snapshot.retention.isEnabled ? 'Aktif' : 'Pasif'}`
              : 'Yüklenemedi'}
          </strong>
        </article>
        <article className="glass-panel" style={{ padding: '1.5rem', borderRadius: '20px', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Gösterilen Log</span>
          <strong style={{ fontSize: '2.5rem', marginTop: '0.5rem', color: 'var(--accent)' }}>{snapshot.logs.length}</strong>
        </article>
      </section>

      <section className="glass-panel" style={{ padding: '2.5rem', borderRadius: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <p className="eyebrow" style={{ margin: 0, color: 'var(--accent)' }}>Son Hareketler</p>
            <h2 style={{ margin: '0.5rem 0 0', fontSize: '1.8rem', color: 'var(--text)' }}>İlk 10 Audit Kaydı</h2>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link href="/admin/audit-logs" className="btn-secondary" style={{ textDecoration: 'none' }}>Yenile</Link>
            <a href={`${apiUrl}/admin/audit-logs/export?format=csv&limit=50`} className="btn-primary" style={{ textDecoration: 'none' }}>CSV İndir</a>
            <a href={`${apiUrl}/admin/audit-logs/export?format=excel&limit=50`} className="btn-primary" style={{ textDecoration: 'none', background: '#10b981', borderColor: '#10b981' }}>Excel İndir</a>
          </div>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '16px', background: 'rgba(255, 255, 255, 0.01)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--surface)' }}>
                <th style={{ padding: '1.2rem', color: 'var(--muted)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Event</th>
                <th style={{ padding: '1.2rem', color: 'var(--muted)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Kategori</th>
                <th style={{ padding: '1.2rem', color: 'var(--muted)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aktör</th>
                <th style={{ padding: '1.2rem', color: 'var(--muted)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hedef</th>
                <th style={{ padding: '1.2rem', color: 'var(--muted)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Route</th>
                <th style={{ padding: '1.2rem', color: 'var(--muted)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Zaman</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.logs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                    {snapshot.reachable
                      ? 'Henüz audit kaydı yok.'
                      : 'Admin token ve API erişimi olmadan canlı log çekilemedi; sayfa yine de hazır.'}
                  </td>
                </tr>
              ) : (
                snapshot.logs.map((log) => (
                  <tr key={log.id} style={{ borderTop: '1px solid var(--border)', transition: 'background 0.2s', ...({ ':hover': { background: 'rgba(255, 255, 255, 0.05)' } } as any) }}>
                    <td style={{ padding: '1rem 1.2rem', color: '#10b981', fontWeight: 600 }}>{log.eventType}</td>
                    <td style={{ padding: '1rem 1.2rem', color: 'var(--text)' }}>{log.category}</td>
                    <td style={{ padding: '1rem 1.2rem', color: 'var(--muted)', fontFamily: 'monospace' }}>{log.actorUserId ?? log.actorType}</td>
                    <td style={{ padding: '1rem 1.2rem', color: 'var(--muted)', fontFamily: 'monospace' }}>{log.targetUserId ?? log.entityId ?? '-'}</td>
                    <td style={{ padding: '1rem 1.2rem', color: 'var(--accent)', fontSize: '0.85rem' }}>{log.route ?? '-'}</td>
                    <td style={{ padding: '1rem 1.2rem', color: 'var(--muted)', fontSize: '0.85rem' }}>{new Date(log.createdAt).toLocaleString('tr-TR')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
