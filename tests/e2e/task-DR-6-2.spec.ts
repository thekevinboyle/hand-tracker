/**
 * Task DR-6.2 — JetBrains Mono self-host E2E.
 *
 * Asserts:
 *   1. The font file at `/fonts/JetBrainsMono-Medium-subset.woff2` is
 *      served with HTTP 200 + an immutable long-cache Cache-Control +
 *      a plausible font MIME type.
 *   2. `document.fonts.ready` resolves within 5s, confirming the
 *      registered @font-face rules resolve to an actual font load.
 *   3. `getComputedStyle(document.body).fontFamily` includes
 *      `JetBrains Mono` after the ready promise settles.
 *   4. The OFL `/fonts/LICENSE.txt` ships publicly (OFL compliance).
 *
 * Describe prefix is exactly `Task DR-6.2:` so
 * `pnpm test:e2e --grep "Task DR-6.2:"` resolves these tests only.
 *
 * Header parity: the vite preview server mirrors the Vercel Cache-Control
 * for `/fonts/*` via the `fontsCacheControlPlugin` in `vite.config.ts`
 * (per D32). Production parity for the full security-header stack is
 * asserted manually in DR-6.R — Task 5.2 already verified curl output.
 */

import { expect, test } from '@playwright/test';

test.describe('Task DR-6.2: JetBrains Mono loads + body renders in mono', () => {
  test('serves /fonts/JetBrainsMono-Medium-subset.woff2 with immutable cache', async ({
    page,
    request,
  }) => {
    await page.goto('/');

    const r = await request.get('/fonts/JetBrainsMono-Medium-subset.woff2');
    expect(r.status()).toBe(200);

    const headers = r.headers();
    const cc = headers['cache-control'] ?? '';
    expect(cc).toContain('max-age=31536000');
    expect(cc).toContain('immutable');

    const contentType = headers['content-type'] ?? '';
    // Accept any plausible font MIME; some hosts serve `application/octet-stream`
    // for woff2 unless configured explicitly.
    expect(contentType).toMatch(/font\/woff2|application\/font-woff2|application\/octet-stream/);

    const body = await r.body();
    // Subset files sit ~12 KB; sanity-bracket well clear of 404 HTML and of
    // a non-subset full ttf (~270 KB → ~80 KB woff2).
    expect(body.byteLength).toBeGreaterThan(8_000);
    expect(body.byteLength).toBeLessThan(40_000);
  });

  test('body computed font-family includes JetBrains Mono after fonts.ready', async ({ page }) => {
    await page.goto('/');

    // Wait until the font set settles. `document.fonts.ready` resolves when
    // all pending font fetches complete or fail — a 5s timeout here gives
    // the preload + on-demand Medium fetch plenty of headroom.
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('document.fonts.ready > 5s')), 5_000);
          document.fonts.ready.then(() => {
            clearTimeout(t);
            resolve();
          });
        }),
    );

    const fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(fontFamily).toContain('JetBrains Mono');

    // Additionally force-load the 500 weight to prove the @font-face rule
    // for Medium resolves the woff2 file. `document.fonts.load()` returns
    // the matching FontFace entries once they hit `status === 'loaded'`.
    const mediumLoaded = await page.evaluate(async () => {
      const faces = await document.fonts.load('500 1em "JetBrains Mono"');
      return faces.length > 0 && faces.every((f) => f.status === 'loaded');
    });
    expect(mediumLoaded).toBe(true);
  });

  test('serves /fonts/LICENSE.txt publicly for OFL compliance', async ({ page, request }) => {
    await page.goto('/');
    const r = await request.get('/fonts/LICENSE.txt');
    expect(r.status()).toBe(200);
    const text = await r.text();
    expect(text).toMatch(/SIL OPEN FONT LICENSE/i);
    expect(text).toMatch(/JetBrains/);
  });
});
