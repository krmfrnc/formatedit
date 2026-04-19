import { useAuth } from '../../_lib/auth';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface ChannelStatus {
  channel: 'EMAIL' | 'WHATSAPP' | 'TELEGRAM' | 'IN_APP';
  enabled: boolean;
}

async function listChannels(): Promise<{ items: ChannelStatus[]; reachable: boolean }> {
  try {
    const { token } = await useAuth();
    const res = await fetch(`${apiUrl}/admin/notifications/channels`, {
      cache: 'no-store',
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return { items: [], reachable: false };
    return { items: (await res.json()) as ChannelStatus[], reachable: true };
  } catch {
    return { items: [], reachable: false };
  }
}

/** Task 294: Notification channels admin UI. */
export default async function NotificationChannelsPage() {
  const { items, reachable } = await listChannels();

  return (
    <div>
      <h1>Notification channels</h1>
      <p style={{ color: '#64748b' }}>
        Platform-wide kill switches. Disabling a channel stops all outbound messages on it until re-enabled.
      </p>
      {!reachable ? (
        <div role="alert">API not reachable.</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Channel</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.channel}>
                <td>{c.channel}</td>
                <td>{c.enabled ? 'Enabled' : 'Disabled'}</td>
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
