import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    // jsdom form tests exceed the 5s default when many files run at once (hook, CI).
    testTimeout: 15000,
    // Agent worktrees under .claude/worktrees hold full repo copies; don't run their tests.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
