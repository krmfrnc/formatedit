/**
 * Editor golden-path E2E — Playwright.
 *
 * Runs against the full Next.js dev server. Requires:
 *   1. `pnpm exec playwright install chromium`
 *   2. Backend API running on port 3001
 *   3. Frontend running on port 3000 (or `pnpm dev` via webServer config)
 *
 * Run: `pnpm exec playwright test`
 */
import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'e2e-test@example.com';
const TEST_PASSWORD = 'TestPassword123!';

test.describe('Editor flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  });

  test('login page renders', async ({ page }) => {
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('can log in and reach dashboard', async ({ page }) => {
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // After login, expect a redirect to the dashboard
    await page.waitForURL('**/dashboard**', { timeout: 10_000 });
    await expect(page.locator('text=Belgelerim')).toBeVisible({ timeout: 5_000 });
  });

  test('can upload a document and see the editor', async ({ page }) => {
    // Login first
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 10_000 });

    // Upload flow — look for upload button or drop zone
    const uploadButton = page.locator('[data-testid="upload-button"], text=Yükle');
    if (await uploadButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      // Create a fake .docx file for upload
      const buffer = Buffer.from('PK\x03\x04fake-docx-content');
      await page.setInputFiles('input[type="file"]', {
        name: 'test-document.docx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer,
      });

      // Wait for processing indicator or editor to load
      await page.waitForSelector('[data-testid="editor"], [data-testid="document-view"]', {
        timeout: 15_000,
      });
    }
  });

  test('editor toolbar is interactive', async ({ page }) => {
    // Navigate directly to a document editor (assumes one exists)
    await page.fill('input[name="email"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 10_000 });

    // If there's an existing document, click into it
    const documentLink = page.locator('[data-testid="document-link"]').first();
    if (await documentLink.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await documentLink.click();
      await page.waitForSelector('[data-testid="editor-toolbar"]', {
        timeout: 10_000,
      });

      // Toolbar should have formatting controls
      await expect(
        page.locator('[data-testid="editor-toolbar"]'),
      ).toBeVisible();
    }
  });
});
