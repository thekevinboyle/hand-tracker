/**
 * Register the production service worker (Task 5.1).
 *
 * Guarded by both `import.meta.env.PROD` and `MODE === 'test'` so:
 *   - `pnpm dev` (MODE=development, PROD=false) → no SW registered.
 *   - `pnpm build` (MODE=production, PROD=true) → SW registers.
 *   - `pnpm build --mode test` (MODE=test, PROD=false) → SW registers so
 *     the Playwright webServer's preview can exercise cache behavior.
 *     (Task file proposed PROD-only but that would make the L4 spec
 *     unverifiable since our E2E runs against the MODE=test bundle.)
 *
 * Runs once at module load from `main.tsx` — NOT inside a React component.
 * StrictMode's double-invoke only affects React trees, so no guard flag is
 * needed here. Registration failures are logged via `console.warn` (not
 * `console.error` so the app's error surfaces stay clean) and swallowed so
 * the rest of the boot path keeps running.
 */
export function registerSW(): void {
  const shouldRegister = import.meta.env.PROD || import.meta.env.MODE === 'test';
  if (!shouldRegister) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err: unknown) => {
      console.warn('[sw] registration failed', err);
    });
  });
}
