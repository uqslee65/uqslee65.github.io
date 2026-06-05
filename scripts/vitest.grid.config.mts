import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Standalone vitest config for the m0nius-reconciliation grid runner.
// Root = repo root; inline zigan-simulation so its TypeScript source is transformed
// (it lives under node_modules and is otherwise externalized).
export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  test: {
    include: ['scripts/our-plan-i-grid.test.ts'],
    server: { deps: { inline: [/zigan-simulation/] } },
    testTimeout: 300000,
    pool: 'threads',
  },
});
