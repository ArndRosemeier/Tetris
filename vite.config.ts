import { defineConfig } from 'vitest/config';

// The app is published under a subpath on the static host (apps.futuremagic.de/Tetris),
// so the base path is set from the environment and defaults to '/' for local dev.
const fromEnv = process.env.TETRIS_BASE?.trim();
const base =
  fromEnv && fromEnv.length > 0
    ? fromEnv.endsWith('/')
      ? fromEnv
      : `${fromEnv}/`
    : '/';

export default defineConfig({
  root: '.',
  base,
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5175,
    open: false,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
});
