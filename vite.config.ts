import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Mirror of vercel.json `headers` — D32 requires dev-server + preview to match
// production exactly so local regression catches header drift before deploy.
const SECURITY_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Permissions-Policy': 'camera=(self)',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; worker-src 'self' blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
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
