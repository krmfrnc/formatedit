/**
 * Task 299: Admin console E2E smoke suite.
 *
 * Walks every admin route introduced in batch 12 and asserts the basic
 * accessibility landmarks. These tests do not exercise the data flow (no
 * login or API mocking) because the admin preview-token pattern renders a
 * graceful "API not reachable" state — the tests assert the shell is
 * correctly wired either way.
 *
 * Run: `pnpm exec playwright test e2e/admin.spec.ts`
 */
import { test, expect } from '@playwright/test';

const routes: Array<{ path: string; heading: RegExp }> = [
  { path: '/admin', heading: /dashboard/i },
  { path: '/admin/users', heading: /users/i },
  { path: '/admin/tickets', heading: /tickets/i },
  { path: '/admin/feature-flags', heading: /feature flags/i },
  { path: '/admin/announcements', heading: /announcements/i },
  { path: '/admin/legal', heading: /legal documents/i },
  { path: '/admin/coupons', heading: /coupons/i },
  { path: '/admin/analytics', heading: /analytics/i },
  { path: '/admin/reports', heading: /reports/i },
  { path: '/admin/notifications', heading: /notification channels/i },
  { path: '/admin/system-settings', heading: /system settings/i },
];

for (const route of routes) {
test(`admin route ${route.path} renders shell + heading`, async ({ page }) => {
    await page.goto(route.path);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('navigation', { name: /admin navigation/i })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(route.heading);
    await expect(page.locator('.skip-link')).toHaveCount(1);
  });
}

test('admin theme toggle persists dark mode', async ({ page }) => {
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('skip link moves focus to main content', async ({ page }) => {
  await page.goto('/admin/system-settings');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#admin-main-content')).toBeFocused();
});
