/**
 * Task DR-6.R — Phase DR-6 foundation regression.
 *
 * The aggregate L4 gate for Phase DR-6. Tasks DR-6.1 + DR-6.2 + DR-6.3 each
 * shipped focused specs for their own slice; this spec proves the THREE
 * foundation slices *compose* correctly at runtime and the existing Tweakpane
 * chrome still survives on top of them.
 *
 * Scope (foundation invariants only):
 *   TEST 1 — tokens + font + body baseline compose (DR-6.1 + 6.2 + 6.3).
 *   TEST 2 — Medium woff2 served + immutable long-cache (DR-6.2 + D33 parity
 *            via fontsCacheControlPlugin).
 *   TEST 3 — PrePromptCard still renders in the DR5 palette + DR7 font
 *            (existing chrome survives the DR14 card wiring).
 *   TEST 4 — after camera grant, Tweakpane params-panel + Stage both mount
 *            (existing Tweakpane chrome survives the foundation).
 *   TEST 5 — served HTML contains the DR19 signature comment.
 *
 * Describe prefix MUST start with literal `Task DR-6.R:` so
 * `pnpm test:e2e --grep "Task DR-6.R:"` resolves these tests only.
 *
 * Gotchas baked in:
 *   - `document.fonts.ready` only settles pending loads — explicitly call
 *     `document.fonts.load('500 1em "JetBrains Mono"')` for weight assertions.
 *   - LightningCSS normalises hex; always compare *resolved* computed values
 *     (canonical `rgb(r, g, b)`).
 *   - Default Playwright viewport is 1280×720. Tests that depend on a
 *     specific clamp output (floor vs ceiling) set the viewport explicitly.
 *   - Tweakpane mounts after camera grant — use `context.grantPermissions`
 *     so the fake Y4M webcam flows through without a prompt.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const SHOT_DIR = 'reports/DR-6-regression';

async function snap(page: Page, step: number, label: string): Promise<void> {
  await fs.mkdir(SHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(SHOT_DIR, `step-${String(step).padStart(2, '0')}-${label}.png`),
    fullPage: false,
  });
}

async function waitForFontsReady(page: Page): Promise<void> {
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
  await page.evaluate(() => document.fonts.load('500 1em "JetBrains Mono"'));
}

test.describe('Task DR-6.R: Phase DR-6 foundation invariants', () => {
  test('tokens, JetBrains Mono, and body baseline compose at runtime', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toBeAttached({ timeout: 30_000 });
    await waitForFontsReady(page);

    // Resolve color tokens through a probe element so LightningCSS
    // hex-shortening (`#333333` → `#333`) doesn't affect the comparison —
    // we compare browser-canonical `rgb(r, g, b)`.
    const bgColor = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.color = 'var(--color-bg)';
      document.body.appendChild(probe);
      const rgb = getComputedStyle(probe).color;
      probe.remove();
      return rgb;
    });

    const values = await page.evaluate(() => {
      const r = getComputedStyle(document.documentElement);
      const b = getComputedStyle(document.body);
      return {
        tokenSpring: r.getPropertyValue('--ease-spring').trim(),
        fontMedium: r.getPropertyValue('--font-weight-medium').trim(),
        bodyFontFamily: b.fontFamily,
        bodyFontSize: b.fontSize,
        bodyFontWeight: b.fontWeight,
        bodyColor: b.color,
        bodyBackground: b.backgroundColor,
        rootLetterSpacing: r.letterSpacing,
      };
    });

    // DR5 — soft-dark surface.
    expect(bgColor).toBe('rgb(10, 10, 11)'); // #0A0A0B

    // DR11 — spring easing token. LightningCSS may drop whitespace inside
    // cubic-bezier(), so normalise for comparison.
    expect(values.tokenSpring.replace(/\s+/g, '')).toBe('cubic-bezier(.47,0,.23,1.38)');

    // DR7 — medium weight token + body actually inherits it.
    expect(values.fontMedium).toBe('500');
    expect(values.bodyFontWeight).toBe('500');

    // DR-6.2 — body font-family resolves to JetBrains Mono (subset woff2).
    expect(values.bodyFontFamily).toContain('JetBrains Mono');

    // DR7 — body font-size lives inside clamp(13px, 0.9vw, 16px). At 1440×900
    // 0.9vw = 12.96px so the 13px floor wins.
    const bodyPx = Number.parseFloat(values.bodyFontSize);
    expect(bodyPx).toBe(13);

    // DR5 — text + surface palette on the body.
    expect(values.bodyColor).toBe('rgb(234, 234, 234)'); // #EAEAEA
    expect(values.bodyBackground).toBe('rgb(10, 10, 11)'); // #0A0A0B

    // DR7 — small negative letter-spacing (computed from -0.01em).
    const ls = Number.parseFloat(values.rootLetterSpacing);
    expect(ls).toBeLessThan(0);
    expect(ls).toBeGreaterThan(-1);
  });

  test('Medium woff2 loads with long-cache header (D33 parity)', async ({ page, request }) => {
    await page.goto('/');
    const r = await request.get('/fonts/JetBrainsMono-Medium-subset.woff2');
    expect(r.status()).toBe(200);
    const cc = r.headers()['cache-control'] ?? '';
    expect(cc).toContain('max-age=31536000');
    expect(cc).toContain('immutable');
  });

  test('PrePromptCard renders with new palette + JetBrains Mono', async ({ page }) => {
    // The Playwright config auto-grants camera (permissions: ['camera']) so the
    // state machine normally transitions PROMPT → GRANTED before we can inspect
    // the card. Force a PROMPT-state hold by stalling `getUserMedia` — the hook
    // stays in its initial PROMPT state and PrePromptCard stays mounted.
    await page.addInitScript(() => {
      const never = new Promise<MediaStream>(() => {
        /* never resolves */
      });
      const md = navigator.mediaDevices;
      if (md) {
        md.getUserMedia = () => never;
      }
      // Also stall permissions.query so useCamera's prompt-detection path
      // doesn't flip to GRANTED before we snapshot the card.
      if (navigator.permissions) {
        navigator.permissions.query = () =>
          Promise.resolve({
            state: 'prompt',
            name: 'camera',
            onchange: null,
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent: () => true,
          } as unknown as PermissionStatus);
      }
    });

    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toHaveText('PROMPT', { timeout: 30_000 });
    await waitForFontsReady(page);

    // DR14 — pre-prompt card still mounts with its stable testid.
    const card = page.getByTestId('error-state-card-PROMPT');
    await expect(card).toBeVisible();

    const cardColor = await card.evaluate((el) => getComputedStyle(el).color);
    const titleFontFamily = await page.evaluate(() => {
      const title = document.querySelector('#prp-title') as HTMLElement | null;
      return title ? getComputedStyle(title).fontFamily : '';
    });

    // Card inherits the DR5 text color from body.
    expect(cardColor).toBe('rgb(234, 234, 234)');
    // Title inherits JetBrains Mono from :root.
    expect(titleFontFamily).toContain('JetBrains Mono');
  });

  test('after camera grant, Tweakpane params-panel + Stage both mount', async ({ page }) => {
    // The Playwright config auto-grants camera via permissions:['camera'] +
    // `--use-fake-ui-for-media-stream` so useCamera auto-transitions
    // PROMPT → GRANTED on mount. We just goto and assert the existing
    // Tweakpane chrome still renders on top of the new foundation.
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 30_000 });

    // Existing chrome survives the foundation:
    //   - Tweakpane Params panel renders with its stable testid.
    //   - Stage wrapper is attached.
    await expect(page.getByTestId('params-panel')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('stage')).toBeVisible();
  });

  test('served HTML contains the DR19 rework signature comment', async ({ request }) => {
    const r = await request.get('/');
    const html = await r.text();
    expect(html).toContain('<!-- Hand Tracker FX — pixelcrash-inspired rework 2026-04-20 -->');
  });

  test('walkthrough: 4 screenshots covering the full current-UI journey', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Step 1 — pre-prompt card. Stall getUserMedia to hold PROMPT state so the
    // card can be captured (same pattern as TEST 3 above).
    await page.addInitScript(() => {
      const never = new Promise<MediaStream>(() => {});
      const md = navigator.mediaDevices;
      if (md) md.getUserMedia = () => never;
      if (navigator.permissions) {
        navigator.permissions.query = () =>
          Promise.resolve({
            state: 'prompt',
            name: 'camera',
            onchange: null,
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent: () => true,
          } as unknown as PermissionStatus);
      }
    });
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toHaveText('PROMPT', { timeout: 30_000 });
    await page.evaluate(() => document.fonts.load('500 1em "JetBrains Mono"'));
    await expect(page.getByTestId('error-state-card-PROMPT')).toBeVisible();
    await snap(page, 1, 'pre-prompt');

    // Step 2 — GRANTED + Tweakpane. Drop the getUserMedia stall by reloading
    // without the init-script hold. Use a fresh context via a fresh page so
    // addInitScript doesn't leak; Playwright re-applies init scripts on
    // every new document, so we navigate away first then remove them by
    // switching pages via context.newPage().
    const context = page.context();
    await page.close();
    const page2 = await context.newPage();
    await page2.setViewportSize({ width: 1440, height: 900 });
    await page2.goto('/');
    await expect(page2.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 30_000 });
    await expect(page2.getByTestId('params-panel')).toBeVisible({ timeout: 10_000 });
    await expect(page2.getByTestId('stage')).toBeVisible();
    // Give the mosaic + hand overlay a moment to settle.
    await page2.waitForTimeout(1_500);
    await snap(page2, 2, 'granted-mosaic-tweakpane');

    // Step 3 — Tweakpane panel focus. Scroll/hover the panel so the screenshot
    // emphasises the chrome rendered in JetBrains Mono (Tweakpane v4 uses its
    // own font-family — that's EXPECTED and is retired in DR-8.6; capturing
    // the current state here is deliberate evidence).
    await page2.getByTestId('params-panel').hover();
    await snap(page2, 3, 'tweakpane-panel');

    // Step 4 — record button hover. Record button is a fixed-position element
    // in the top-right via `data-testid="record-button"`.
    const recordBtn = page2.getByTestId('record-button').locator('button').first();
    await recordBtn.hover();
    await page2.waitForTimeout(300);
    await snap(page2, 4, 'record-button-hover');
  });
});
