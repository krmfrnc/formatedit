import type { Config } from 'jest';

/**
 * End-to-end / integration test configuration.
 *
 * Matches `*.e2e-spec.ts` files under `test/`. These tests exercise NestJS
 * modules wired together (via `Test.createTestingModule`) and may stand up
 * real dependencies when available. They are kept separate from unit tests
 * so the unit suite stays fast and deterministic.
 */
const config: Config = {
  displayName: 'api-e2e',
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  roots: ['<rootDir>/test'],
  testRegex: '.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@formatedit/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/jest-setup.ts'],
  testTimeout: 30_000,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',
    '!src/**/*.types.ts',
    '!src/**/*.constants.ts',
    '!src/**/*.dto.ts',
    '!src/**/index.ts',
    '!src/main.ts',
  ],
  coverageDirectory: '<rootDir>/coverage/e2e',
  coverageReporters: ['text-summary', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};

export default config;
