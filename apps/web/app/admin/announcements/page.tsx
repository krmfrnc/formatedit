import { useAuth } from '../../_lib/auth';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface AnnouncementRow {
  id: string;
  title: string;
  severity: string;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

async function listAnnouncements(): Promise<{ items: AnnouncementRow[]; reachable: boolean }> {
  try {
    const { token } = await useAuth();
    const res = await fetch(`${apiUrl}/admin/announcements`, {
      cache: 'no-store',
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return { items: [], reachable: false };
    return { items: (await res.json()) as AnnouncementRow[], reachable: true };
  } catch {
    return { items: [], reachable: false };
  }
}

/** Task 288: Announcement banner management. */
export default async function AnnouncementsPage() {
  const { items, reachable } = await listAnnouncements();

  return (
    <div>
      <h1>Announcements</h1>
      <p style={{ color: '#64748b' }}>Site-wide banner content. Active entries are served to unauthenticated pages too.</p>
      {!reachable ? (
        <div role="alert">API not reachable.</div>
      ) : items.length === 0 ? (
        <p>No announcements configured.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Severity</th>
              <th>Active</th>
              <th>Window</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td>{a.title}</td>
                <td>{a.severity}</td>
                <td>{a.isActive ? 'Yes' : 'No'}</td>
                <td>
                  {a.startsAt ? new Date(a.startsAt).toLocaleDateString() : '—'} –{' '}
                  {a.endsAt ? new Date(a.endsAt).toLocaleDateString() : '—'}
                </td>
                <td>{new Date(a.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <style>{`
        .admin-table { border-collapse: collapse; width: 100%; background: #fff; }
        .admin-table th, .admin-table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 14px; }
        .admin-table th { background: #f1f5f9; color: #475569; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
      `}</style>
    </div>
  );
}
