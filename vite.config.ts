import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const SECURITY_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Permissions-Policy': 'camera=(self)',
} as const;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    headers: SECURITY_HEADERS,
  },
  preview: {
    port: 4173,
    headers: SECURITY_HEADERS,
  },
  build: {
    target: ['chrome120', 'firefox132', 'safari17'],
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@mediapipe/tasks-vision')) return 'mediapipe';
          if (id.includes('node_modules/ogl')) return 'ogl';
          if (id.includes('node_modules/tweakpane') || id.includes('node_modules/@tweakpane')) {
            return 'tweakpane';
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'tests/e2e/**'],
  },
});
