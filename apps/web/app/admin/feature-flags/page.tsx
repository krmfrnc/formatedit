const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface FlagRow {
  key: string;
  description: string | null;
  enabled: boolean;
  audience: string;
  rolloutPercent: number;
  updatedAt: string;
}

async function listFlags(): Promise<{ items: FlagRow[]; reachable: boolean }> {
  try {
    const res = await fetch(`${apiUrl}/admin/feature-flags`, {
      cache: 'no-store',
      headers: { authorization: 'Bearer admin-preview-token' },
    });
    if (!res.ok) return { items: [], reachable: false };
    return { items: (await res.json()) as FlagRow[], reachable: true };
  } catch {
    return { items: [], reachable: false };
  }
}

/** Task 272: Feature flags admin page. */
export default async function FeatureFlagsPage() {
  const { items, reachable } = await listFlags();

  return (
    <div>
      <h1>Feature flags</h1>
      <p style={{ color: '#64748b' }}>
        Runtime toggles. Changes take effect on the next evaluation — no deploy needed.
      </p>
      {!reachable ? (
        <div role="alert">API not reachable.</div>
      ) : items.length === 0 ? (
        <p>No feature flags configured.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Enabled</th>
              <th>Audience</th>
              <th>Rollout %</th>
              <th>Description</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {items.map((f) => (
              <tr key={f.key}>
                <td><code>{f.key}</code></td>
                <td>{f.enabled ? 'ON' : 'off'}</td>
                <td>{f.audience}</td>
                <td>{f.rolloutPercent}</td>
                <td>{f.description ?? '—'}</td>
                <td>{new Date(f.updatedAt).toLocaleString()}</td>
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
