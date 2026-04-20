/**
 * Task DR-8.7: Footer E2E.
 *
 * Proves the Task DR-8.7 Footer contract end-to-end:
 *   1. GRANTED state → `<footer data-testid="footer">` is visible, contains
 *      the verbatim copy for both labels, and its computed color matches
 *      the --color-text-muted token (#8F8F8F → rgb(143, 143, 143)).
 *   2. PROMPT state → the footer is NOT rendered; the PrePromptCard owns
 *      the viewport instead.
 *
 * PROMPT is induced by launching a fresh browser context without the
 * Playwright config's auto-camera grant and stalling getUserMedia with a
 * never-resolving promise (the same pattern as DR-8.4 and the DR-6-R
 * walkthrough). Per synergy-fix CRITICAL-03 we drive the camera state
 * through the real UI flow, NOT via any `__handTracker.forceCameraState`
 * dev hook — DR-9.2 owns the full 8-state stub matrix.
 *
 * Describe prefix MUST start with literal `Task DR-8.7:` so
 * `pnpm test:e2e --grep "Task DR-8.7:"` resolves these tests only.
 */

import { expect, test } from '@playwright/test';

test.describe('Task DR-8.7: Footer visible + styled in GRANTED state', () => {
  test('footer renders with verbatim copy and muted color token', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 30_000 });

    const footer = page.getByTestId('footer');
    await expect(footer).toBeVisible();

    // Verbatim copy — both labels must appear in the rendered footer.
    await expect(footer).toContainText('hand-tracker-fx v0.1.0');
    await expect(footer).toContainText('Built with MediaPipe, ogl, React');

    // DR5 --color-text-muted = #8F8F8F → rgb(143, 143, 143). LightningCSS
    // shortens #888888 style hex but leaves #8F8F8F alone; the real
    // Chromium CSS engine resolves the custom property to rgb() so the
    // equality check is exact.
    const color = await footer.evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe('rgb(143, 143, 143)');

    // DR7 — JetBrains Mono inherits from :root through the footer.
    const fontFamily = await footer.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(fontFamily).toContain('JetBrains Mono');

    // The footer is an actual <footer> landmark, not a styled div.
    const tag = await footer.evaluate((el) => el.tagName.toLowerCase());
    expect(tag).toBe('footer');
  });

  test('footer lives inside .app-layout (row below .app-body)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 30_000 });

    const placement = await page.evaluate(() => {
      const layout = document.querySelector('.app-layout');
      const body = document.querySelector('.app-body');
      const footer = document.querySelector('[data-testid="footer"]');
      return {
        hasLayout: !!layout,
        footerInsideLayout: !!layout && !!footer && layout.contains(footer),
        // The footer is NOT inside .app-body — it's the row below it.
        footerOutsideBody: !!footer && !!body && !body.contains(footer),
      };
    });
    expect(placement.hasLayout).toBe(true);
    expect(placement.footerInsideLayout).toBe(true);
    expect(placement.footerOutsideBody).toBe(true);
  });
});

test.describe('Task DR-8.7: Footer hidden on PROMPT (error/pre-prompt) screens', () => {
  test('no footer in the DOM when camera state is PROMPT', async ({ browser }) => {
    // Fresh context without the Playwright config's camera permission.
    const context = await browser.newContext({ permissions: [] });
    const page = await context.newPage();

    // Stall getUserMedia so useCamera can't auto-transition to GRANTED
    // before our assertions run.
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

    // PrePromptCard is up instead of the Toolbar/Stage/Sidebar chrome.
    await expect(page.getByTestId('error-state-card-PROMPT')).toBeVisible();

    // Footer is NOT rendered — the GRANTED branch in App.tsx is the only
    // site that mounts it.
    await expect(page.getByTestId('footer')).toHaveCount(0);

    await context.close();
  });
});
