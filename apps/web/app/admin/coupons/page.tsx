import { useAuth } from '../../_lib/auth';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface CouponRow {
  id: string;
  code: string;
  name: string;
  discountType: string;
  discountValue: number;
  isActive: boolean;
  redeemedCount: number;
  maxRedemptions: number | null;
  expiresAt: string | null;
}

async function listCoupons(): Promise<{ items: CouponRow[]; reachable: boolean }> {
  try {
    const { token } = await useAuth();
    const res = await fetch(`${apiUrl}/admin/coupons`, {
      cache: 'no-store',
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return { items: [], reachable: false };
    return { items: (await res.json()) as CouponRow[], reachable: true };
  } catch {
    return { items: [], reachable: false };
  }
}

/** Task 290: Coupon management page. */
export default async function CouponsPage() {
  const { items, reachable } = await listCoupons();

  return (
    <div>
      <h1>Coupons</h1>
      {!reachable ? (
        <div role="alert">API not reachable.</div>
      ) : items.length === 0 ? (
        <p>No coupons configured.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Discount</th>
              <th>Active</th>
              <th>Redemptions</th>
              <th>Expires</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td><code>{c.code}</code></td>
                <td>{c.name}</td>
                <td>
                  {c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : `$${(c.discountValue / 100).toFixed(2)}`}
                </td>
                <td>{c.isActive ? 'Yes' : 'No'}</td>
                <td>
                  {c.redeemedCount}
                  {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}
                </td>
                <td>{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '—'}</td>
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
