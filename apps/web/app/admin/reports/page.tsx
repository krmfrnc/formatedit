const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface ReportRow {
  id: string;
  type: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  errorMessage: string | null;
}

async function listReports(): Promise<{ items: ReportRow[]; reachable: boolean }> {
  try {
    const res = await fetch(`${apiUrl}/admin/analytics/reports`, {
      cache: 'no-store',
      headers: { authorization: 'Bearer admin-preview-token' },
    });
    if (!res.ok) return { items: [], reachable: false };
    return { items: (await res.json()) as ReportRow[], reachable: true };
  } catch {
    return { items: [], reachable: false };
  }
}

/** Tasks 283-285: Stored analytics reports. */
export default async function ReportsPage() {
  const { items, reachable } = await listReports();

  return (
    <div>
      <h1>Reports</h1>
      <p style={{ color: '#64748b' }}>
        Generated analytics snapshots. Emailed deliveries appear here too.
      </p>
      {!reachable ? (
        <div role="alert">API not reachable.</div>
      ) : items.length === 0 ? (
        <p>No reports have been generated yet.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Status</th>
              <th>Window</th>
              <th>Generated</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{r.type}</td>
                <td>{r.status}</td>
                <td>
                  {new Date(r.periodStart).toLocaleDateString()} –{' '}
                  {new Date(r.periodEnd).toLocaleDateString()}
                </td>
                <td>{new Date(r.generatedAt).toLocaleString()}</td>
                <td>{r.errorMessage ?? '—'}</td>
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
