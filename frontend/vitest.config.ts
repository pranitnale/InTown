import { defineConfig } from 'vitest/config';

// Node-environment test runner. The contrast-assertion test is pure computation
// over contracts/design-tokens.json; no DOM or React plugins are required.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
