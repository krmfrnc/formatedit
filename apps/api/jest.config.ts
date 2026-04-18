import type { Config } from 'jest';

/**
 * Unit test configuration.
 *
 * Picks up any `*.spec.ts` file under `src/` or `test/` (but NOT `*.e2e-spec.ts`).
 * E2E tests live in `jest-e2e.config.ts` and run separately.
 *
 * Coverage thresholds are intentionally left unset here — they will be enabled
 * in fix F19 once per-module unit tests (F9–F13) land.
 */
const config: Config = {
  displayName: 'api-unit',
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testRegex: '.*(?<!\\.e2e)\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@formatedit/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/jest-setup.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',
    '!src/**/*.types.ts',
    '!src/**/*.constants.ts',
    '!src/**/*.dto.ts',
    '!src/**/index.ts',
    '!src/main.ts',
  ],
  coverageDirectory: '<rootDir>/coverage/unit',
  coverageReporters: ['text-summary', 'lcov', 'json-summary'],
  // Unit tests only cover the parser module today. Global thresholds are low
  // because most coverage comes from e2e tests. Raise as unit coverage expands.
  coverageThreshold: {
    global: {
      branches: 3,
      functions: 4,
      lines: 7,
      statements: 7,
    },
  },
};

export default config;
