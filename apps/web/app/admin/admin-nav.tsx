'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';

const navSections: Array<{ heading: string; links: Array<{ href: Route; label: string }> }> = [
  {
    heading: 'Overview',
    links: [
      { href: '/admin', label: 'Dashboard' },
      { href: '/admin/audit-logs', label: 'Audit logs' },
    ],
  },
  {
    heading: 'Operations',
    links: [
      { href: '/admin/users', label: 'Users' },
      { href: '/admin/tickets', label: 'Tickets' },
      { href: '/admin/templates', label: 'Templates' },
      { href: '/admin/coupons', label: 'Coupons' },
    ],
  },
  {
    heading: 'Platform',
    links: [
      { href: '/admin/feature-flags', label: 'Feature flags' },
      { href: '/admin/announcements', label: 'Announcements' },
      { href: '/admin/legal', label: 'Legal documents' },
      { href: '/admin/system-settings', label: 'System settings' },
      { href: '/admin/notifications', label: 'Notification channels' },
    ],
  },
  {
    heading: 'Analytics',
    links: [
      { href: '/admin/analytics', label: 'Analytics' },
      { href: '/admin/reports', label: 'Reports' },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin navigation">
      {navSections.map((section) => (
        <div key={section.heading} className="admin-shell__section">
          <h3>{section.heading}</h3>
          <ul>
            {section.links.map((link) => {
              const isActive = pathname === link.href;

              return (
                <li key={link.href}>
                  <Link href={link.href} aria-current={isActive ? 'page' : undefined}>
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
