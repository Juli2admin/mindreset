import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Vitest config. Kept minimal: alias `@/` to the project root so test files
// import the same way app code does, and restrict the test glob to .test.ts
// files inside lib/ to keep runtime cheap. New tests live next to the
// module they cover (e.g. lib/screening/linkScreeningToUser.test.ts).
export default defineConfig({
  test: {
    include: ['lib/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
