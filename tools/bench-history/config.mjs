import { defineConfig } from 'vitest/config';

// Deliberately outside src/**/*.test.*: npm test/verify never discovers this bench.
export default defineConfig({
  test: {
    cache: false,
    include: ['tools/bench-history/history.bench.jsx'],
    maxWorkers: 1,
    testTimeout: 7_200_000, // One test covers every N; 3 000 matches alone take several minutes.
    hookTimeout: 120_000,
  },
});
