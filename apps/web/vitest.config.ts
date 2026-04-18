import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Unit + component test configuration for the Next.js web app.
 *
 * Uses jsdom so React Testing Library can render components without a real
 * browser. Playwright-based end-to-end tests live separately and are added
 * by F16. Coverage thresholds are intentionally unset until F19 establishes
 * the baseline across the whole monorepo.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@formatedit/shared': path.resolve(
        __dirname,
        '../../packages/shared/src/index.ts',
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/vitest-setup.ts'],
    include: ['{app,src,test}/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'dist', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov', 'json-summary'],
      reportsDirectory: './coverage/unit',
      include: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
      exclude: [
        'app/**/layout.tsx',
        'app/**/page.tsx',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
  },
});
