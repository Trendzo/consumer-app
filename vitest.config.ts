import { defineConfig } from 'vitest/config';

/**
 * Pure-logic tests only (src/theme/remoteTheme.ts and friends): node environment,
 * no react-native rendering, no jest. Files under test must keep zero runtime
 * imports so node resolution never touches the RN tree.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
