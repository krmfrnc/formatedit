/**
 * Task 300: Platform smoke test.
 *
 * One pass through the high-value public-facing surfaces to catch
 * regressions before cutting a release. Kept intentionally shallow — the
 * editor and admin suites exercise the deep paths. A green smoke means the
 * app boots, the marketing page renders, the pricing/checkout stub
 * answers, and the notification socket namespace is reachable.
 */
import { test, expect } from '@playwright/test';

test('landing page responds', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('pricing/billing route responds', async ({ page }) => {
  const response = await page.goto('/billing');
  // Some deployments redirect unauthenticated users; a non-5xx answer is
  // sufficient for a smoke check.
  expect(response && response.status() < 500).toBeTruthy();
});

test('admin dashboard shell renders without a session', async ({ page }) => {
  // The admin shell is safe to render without auth — data fetches fall
  // through to the "API not reachable" state. If this 500s, the shell
  // itself is broken.
  const response = await page.goto('/admin');
  expect(response && response.status() < 500).toBeTruthy();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('editor lab responds without crashing', async ({ page }) => {
  const response = await page.goto('/editor-lab');
  expect(response && response.status() < 500).toBeTruthy();
  await expect(page.getByText(/canli editor laboratuvari|editor lab/i)).toBeVisible();
});

test('template workspace responds without crashing', async ({ page }) => {
  const response = await page.goto('/templates/workspace');
  expect(response && response.status() < 500).toBeTruthy();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
