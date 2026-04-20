/**
 * Task DR-6.3 — Base reset + body baseline E2E.
 *
 * Asserts the browser actually computes the body-level typography the way
 * DISCOVERY DR5 + DR7 + DR12 specify:
 *   - font-family resolves to JetBrains Mono (DR-6.2 supplies the
 *     @font-face; this task makes :root consume it).
 *   - font-weight = 500 (DR7 default).
 *   - font-size falls inside clamp(13px, 0.9vw, 16px) — at 1440×900 it
 *     snaps to the 13px floor (0.9vw = 12.96px).
 *   - letter-spacing is a small negative number (computed from -0.01em).
 *   - color / background resolve to the DR5 palette.
 *
 * Robustness note: Vite 8 LightningCSS normalises hex + drops whitespace +
 * shortens leading zeros, so we only compare *resolved* computed values
 * (the browser hands back canonical `rgb(r, g, b)` regardless of source
 * hex casing) and use `Number.parseFloat` for numeric assertions.
 *
 * Describe prefix MUST be `Task DR-6.3:` so
 * `pnpm test:e2e --grep "Task DR-6.3:"` resolves these tests only.
 */

import { expect, test } from '@playwright/test';

// Await document.fonts.ready, then force-load the Medium weight the body
// baseline advertises. `document.fonts.ready` only settles *pending*
// font loads — it does not imply a particular weight/style is resolved,
// so we follow the DR-6.2 pattern and call `document.fonts.load()`
// explicitly before reading computed font-* properties.
async function waitForFontsReady(page: import('@playwright/test').Page): Promise<void> {
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

test.describe('Task DR-6.3: body uses token baseline', () => {
  test('html + body computed styles match the DR7 baseline', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toBeAttached({ timeout: 30_000 });
    await waitForFontsReady(page);

    const styles = await page.evaluate(() => {
      const root = document.documentElement;
      const body = document.body;
      const rootCS = getComputedStyle(root);
      const bodyCS = getComputedStyle(body);
      return {
        rootFontFamily: rootCS.fontFamily,
        rootFontSize: rootCS.fontSize,
        rootFontWeight: rootCS.fontWeight,
        rootLineHeight: rootCS.lineHeight,
        rootLetterSpacing: rootCS.letterSpacing,
        rootColor: rootCS.color,
        rootBackground: rootCS.backgroundColor,
        rootBoxSizing: rootCS.boxSizing,
        bodyFontFamily: bodyCS.fontFamily,
        bodyFontSize: bodyCS.fontSize,
        bodyFontWeight: bodyCS.fontWeight,
        bodyColor: bodyCS.color,
        bodyBackground: bodyCS.backgroundColor,
        bodyMargin: bodyCS.margin,
      };
    });

    // DR-6.2 — family cascades into body via :root.
    expect(styles.rootFontFamily).toContain('JetBrains Mono');
    expect(styles.bodyFontFamily).toContain('JetBrains Mono');

    // DR7 — default weight 500.
    expect(styles.rootFontWeight).toBe('500');
    expect(styles.bodyFontWeight).toBe('500');

    // DR7 — font-size lives inside clamp(13px, 0.9vw, 16px).
    const rootFontPx = Number.parseFloat(styles.rootFontSize);
    const bodyFontPx = Number.parseFloat(styles.bodyFontSize);
    expect(rootFontPx).toBeGreaterThanOrEqual(13);
    expect(rootFontPx).toBeLessThanOrEqual(16);
    expect(bodyFontPx).toBeGreaterThanOrEqual(13);
    expect(bodyFontPx).toBeLessThanOrEqual(16);

    // DR7 — line-height 1.4 (dimensionless) computes to 1.4 × font-size px.
    const lineHeightPx = Number.parseFloat(styles.rootLineHeight);
    expect(lineHeightPx).toBeCloseTo(rootFontPx * 1.4, 0);

    // DR7 — letter-spacing -0.01em is a small negative px at this size.
    const ls = Number.parseFloat(styles.rootLetterSpacing);
    expect(ls).toBeLessThan(0);
    expect(ls).toBeGreaterThan(-1); // sanity bound

    // DR5 — text + surface palette.
    expect(styles.rootColor).toBe('rgb(234, 234, 234)'); // #EAEAEA
    expect(styles.rootBackground).toBe('rgb(10, 10, 11)'); // #0A0A0B
    expect(styles.bodyColor).toBe('rgb(234, 234, 234)');
    expect(styles.bodyBackground).toBe('rgb(10, 10, 11)');

    // Reset — box-sizing cascaded to every element; margin on body is 0.
    expect(styles.rootBoxSizing).toBe('border-box');
    expect(styles.bodyMargin).toBe('0px');
  });

  test('viewport at 1440×900 clamps root font-size to the 13px floor', async ({ page }) => {
    // 0.9vw × 1440 = 12.96px → clamp() floor of 13px wins.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toBeAttached({ timeout: 30_000 });
    await waitForFontsReady(page);

    const { rootPx, bodyPx } = await page.evaluate(() => ({
      rootPx: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
      bodyPx: Number.parseFloat(getComputedStyle(document.body).fontSize),
    }));

    expect(rootPx).toBe(13);
    expect(bodyPx).toBe(13);
  });

  test('viewport at 1920×1080 clamps root font-size to the 16px ceiling', async ({ page }) => {
    // 0.9vw × 1920 = 17.28px → clamp() ceiling of 16px wins.
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toBeAttached({ timeout: 30_000 });
    await waitForFontsReady(page);

    const rootPx = await page.evaluate(() =>
      Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
    );
    expect(rootPx).toBe(16);
  });

  test('Medium-weight JetBrains Mono actually loaded (not fallback monospace)', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toBeAttached({ timeout: 30_000 });
    await waitForFontsReady(page);

    const loaded = await page.evaluate(async () => {
      const faces = await document.fonts.load('500 1em "JetBrains Mono"');
      return {
        count: faces.length,
        allLoaded: faces.length > 0 && faces.every((f) => f.status === 'loaded'),
      };
    });
    expect(loaded.count).toBeGreaterThan(0);
    expect(loaded.allLoaded).toBe(true);
  });
});
