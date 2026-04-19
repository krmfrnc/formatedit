import { useAuth } from '../../_lib/auth';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface TicketRow {
  id: string;
  ticketNumber: string;
  title: string;
  status: string;
  categoryNameSnapshot: string;
  deadlineAt: string | null;
  lastActivityAt: string;
}

async function listTickets(): Promise<{ items: TicketRow[]; reachable: boolean }> {
  try {
    const { token } = await useAuth();
    const res = await fetch(`${apiUrl}/admin/tickets?take=50`, {
      cache: 'no-store',
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return { items: [], reachable: false };
    const data = (await res.json()) as { items: TicketRow[] };
    return { items: data.items, reachable: true };
  } catch {
    return { items: [], reachable: false };
  }
}

/**
 * Task 276: Admin ticket management.
 */
export default async function AdminTicketsPage() {
  const { items, reachable } = await listTickets();

  return (
    <div>
      <h1>Tickets</h1>
      {!reachable ? (
        <div role="alert" style={{ padding: 12, background: '#fef3c7', borderRadius: 8 }}>
          API not reachable.
        </div>
      ) : (
        <table className="admin-table" aria-label="Tickets list">
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Status</th>
              <th>Category</th>
              <th>Deadline</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <td>{t.ticketNumber}</td>
                <td>{t.title}</td>
                <td>{t.status}</td>
                <td>{t.categoryNameSnapshot}</td>
                <td>{t.deadlineAt ? new Date(t.deadlineAt).toLocaleDateString() : '—'}</td>
                <td>{new Date(t.lastActivityAt).toLocaleString()}</td>
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
