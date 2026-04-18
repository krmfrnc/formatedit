const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface LegalDocRow {
  id: string;
  slug: string;
  locale: string;
  title: string;
  version: number;
  isActive: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

async function listDocs(): Promise<{ items: LegalDocRow[]; reachable: boolean }> {
  try {
    const res = await fetch(`${apiUrl}/admin/legal-documents`, {
      cache: 'no-store',
      headers: { authorization: 'Bearer admin-preview-token' },
    });
    if (!res.ok) return { items: [], reachable: false };
    return { items: (await res.json()) as LegalDocRow[], reachable: true };
  } catch {
    return { items: [], reachable: false };
  }
}

/** Task 289: Legal text editor listing. */
export default async function LegalDocumentsPage() {
  const { items, reachable } = await listDocs();

  return (
    <div>
      <h1>Legal documents</h1>
      <p style={{ color: '#64748b' }}>
        Versioned Terms, Privacy, KVKK, GDPR, and Cookies copy.
      </p>
      {!reachable ? (
        <div role="alert">API not reachable.</div>
      ) : items.length === 0 ? (
        <p>No legal documents configured.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Slug</th>
              <th>Locale</th>
              <th>Version</th>
              <th>Title</th>
              <th>Active</th>
              <th>Published</th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id}>
                <td>{d.slug}</td>
                <td>{d.locale}</td>
                <td>v{d.version}</td>
                <td>{d.title}</td>
                <td>{d.isActive ? 'Yes' : 'No'}</td>
                <td>{d.publishedAt ? new Date(d.publishedAt).toLocaleDateString() : '—'}</td>
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
