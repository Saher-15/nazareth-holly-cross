import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 20_000, // bcrypt at cost 12 (about 250 ms a hash) runs in many admin tests
    setupFiles: ['./__tests__/setup.js'],
  },
});
