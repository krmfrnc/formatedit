const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Task 278-282: Full analytics view — mirrors the dashboard snapshot with extra detail. */
export default async function AnalyticsPage() {
  try {
    const res = await fetch(`${apiUrl}/admin/analytics/snapshot`, {
      cache: 'no-store',
      headers: { authorization: 'Bearer admin-preview-token' },
    });
    if (!res.ok) throw new Error('unavailable');
    const snapshot = (await res.json()) as Record<string, unknown>;
    return (
      <div>
        <h1>Analytics</h1>
        <p style={{ color: '#64748b' }}>
          30-day rolling snapshot. Use the reports page to persist a historical record.
        </p>
        <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: 16, borderRadius: 8, overflow: 'auto' }}>
          {JSON.stringify(snapshot, null, 2)}
        </pre>
      </div>
    );
  } catch {
    return (
      <div>
        <h1>Analytics</h1>
        <div role="alert">Analytics data is not available.</div>
      </div>
    );
  }
}
