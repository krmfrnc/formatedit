const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface AdminUserRow {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  isEmailVerified: boolean;
  country: string | null;
  createdAt: string;
}

async function listUsers(): Promise<{ items: AdminUserRow[]; reachable: boolean }> {
  try {
    const res = await fetch(`${apiUrl}/admin/users?take=50`, {
      cache: 'no-store',
      headers: { authorization: 'Bearer admin-preview-token' },
    });
    if (!res.ok) return { items: [], reachable: false };
    const data = (await res.json()) as { items: AdminUserRow[] };
    return { items: data.items, reachable: true };
  } catch {
    return { items: [], reachable: false };
  }
}

/**
 * Task 275: Admin user management.
 */
export default async function AdminUsersPage() {
  const { items, reachable } = await listUsers();

  return (
    <div>
      <h1>Users</h1>
      {!reachable ? (
        <div role="alert" style={{ padding: 12, background: '#fef3c7', borderRadius: 8 }}>
          API not reachable.
        </div>
      ) : (
        <table className="admin-table" aria-label="Users list">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Verified</th>
              <th>Country</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.fullName ?? '—'}</td>
                <td>{u.role}</td>
                <td>{u.isEmailVerified ? 'Yes' : 'No'}</td>
                <td>{u.country ?? '—'}</td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
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
