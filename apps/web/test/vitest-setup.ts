/**
 * Vitest global setup — extends `expect` with jest-dom matchers and ensures
 * React Testing Library automatically unmounts between tests. Run once per
 * worker before any test file loads (wired in `vitest.config.ts`).
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
