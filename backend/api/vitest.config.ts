import { defineConfig } from 'vitest/config';

/**
 * API test runner. Node environment. `globalSetup` runs the migration chain once
 * against the dev/CI Postgres (idempotent). File parallelism is disabled because
 * the suites share one database and TRUNCATE between tests.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/helpers/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
