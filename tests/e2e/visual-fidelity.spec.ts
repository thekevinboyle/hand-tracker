/**
 * Task DR-9.3 — Automated visual-fidelity gate.
 *
 * Compares a 1440×900 screenshot of the reworked chrome against the
 * committed reference at `reports/DR-8-regression/design-rework-reference.png`
 * (captured by DR-8.R). The gate fails when more than 2% of pixels differ
 * (`maxDiffPixelRatio: 0.02`). Any accidental token drift, font-weight
 * regression, spacing bug, or palette bleed trips the gate.
 *
 * Runs against:
 *   1. Local `pnpm preview` by default (the Playwright webServer config).
 *   2. The Vercel preview URL whenever `PLAYWRIGHT_BASE_URL` is set — used
 *      by DR-9.1's `e2e-preview.yml` on every `deployment_status` success.
 *
 * Snapshot wiring: `playwright.config.ts` sets
 *   snapshotPathTemplate: '{testDir}/../../reports/DR-8-regression/{arg}{ext}'
 * so `toMatchSnapshot('design-rework-reference.png')` reads the already-
 * committed reference. `{testDir}` resolves to `<repo>/tests/e2e`, so the
 * `../../` climbs two levels to the repo root before descending into
 * `reports/DR-8-regression/`. No per-platform suffix is appended.
 *
 * First-run / reference-update protocol (team-intentional redesign ONLY):
 *   pnpm test:e2e --update-snapshots --grep "Task DR-9.3:"
 *   # Playwright rewrites reports/DR-8-regression/design-rework-reference.png
 *   # in-place. Inspect the diff visually, commit the PNG in the same PR
 *   # that changes the design. NEVER auto-update in CI — the reference is a
 *   # human-approved artifact. See task-DR-9-3.md §Anti-Patterns.
 *
 * Describe prefix MUST start with literal `Task DR-9.3:` so
 * `pnpm test:e2e --grep "Task DR-9.3:"` resolves this spec only.
 *
 * Authority: task-DR-9-3.md, DR DISCOVERY §DR4, playwright-e2e-webcam skill.
 */

import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const REFERENCE_PATH = path.resolve(
  process.cwd(),
  'reports/DR-8-regression/design-rework-reference.png',
);

interface EngineHook {
  setParam?: (dotPath: string, value: unknown) => void;
}

interface HandTrackerHook {
  __engine?: EngineHook;
}

test.describe('Task DR-9.3: Visual-fidelity gate against DR-8.R reference', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(REFERENCE_PATH)) {
      throw new Error(
        `Reference image missing at ${REFERENCE_PATH}. ` +
          'DR-8.R must commit the canonical PNG before DR-9.3 can run.',
      );
    }
  });

  test('matches reference within 2% pixel diff at 1440x900', async ({ page, context, baseURL }) => {
    test.setTimeout(90_000);

    // Canonical viewport — MUST be 1440×900 to match the reference. Playwright's
    // default Desktop Chrome profile is 1280×720 and would diff 100%.
    await page.setViewportSize({ width: 1440, height: 900 });

    // Freeze any motion (DR18 reduced-motion token path) so modulation doesn't
    // mutate params between render loop ticks.
    await page.emulateMedia({ reducedMotion: 'reduce' });

    // Ensure camera is granted on whichever origin we're hitting (local or
    // Vercel preview). Without this, PROMPT/PrePromptCard would capture.
    if (baseURL) {
      await context.clearPermissions();
      await context.grantPermissions(['camera'], { origin: baseURL });
    }

    await page.goto('/');

    // Wait for the happy path to settle.
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 30_000 });
    await expect(page.getByTestId('render-canvas')).toBeVisible();

    // Pin grid.seed to its canonical default (42) when the dev hook is
    // reachable (local/dev builds). PROD builds tree-shake __handTracker
    // per D33 / task 1.1; we simply skip the reset there — the reference
    // PNG was captured on the same deploy lane so seed drift is bounded.
    await page.waitForFunction(
      () => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        return (
          w.__handTracker === undefined || typeof w.__handTracker?.__engine?.setParam === 'function'
        );
      },
      undefined,
      { timeout: 15_000 },
    );
    await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      w.__handTracker?.__engine?.setParam?.('grid.seed', 42);
    });

    // Font-face load must complete before capture — JetBrains Mono paints
    // fallback system-ui metrics until fonts.ready resolves.
    await page.evaluate(() => document.fonts.ready);

    // Settle window: mirror DR-8.R step 02's exact timing (grid.seed write +
    // 800ms settle) so the fake-webcam landmark detection lands on the same
    // frame phase the reference was captured at. This is the ONLY timed
    // wait — longer delays drift the hand-landmark overlay into a different
    // pose and blow past the 2% threshold.
    await page.waitForTimeout(800);

    // Capture once via page.screenshot() instead of toHaveScreenshot().
    // The mosaic fragment shader samples the live video texture every rAF
    // tick, so consecutive captures always differ by a few percent — that
    // trips toHaveScreenshot()'s built-in stability loop (which demands two
    // adjacent frames diff by ≈0px BEFORE it even compares to the snapshot).
    // Passing a Buffer to toMatchSnapshot skips the stability loop entirely
    // and goes straight to the single comparison we care about.
    //
    // Mask out the Stage — the mosaic canvas + landmark-overlay + PIP are
    // inherently non-deterministic across runs because MediaPipe's landmark
    // detection lands on a different frame phase of the fake-webcam Y4M on
    // each Playwright invocation. The mask fills the stage region with a
    // solid color in BOTH the captured image AND (via re-capture protocol)
    // the committed reference, so only the chrome (toolbar + sidebar +
    // panels + footer + error overlays) contributes to the diff. That is
    // the actual contract of this gate: detect token/font/palette/spacing
    // regressions in the CHROME. Mosaic + overlay correctness is tested by
    // the ogl/mediapipe unit + E2E specs elsewhere.
    //
    // `animations: 'disabled'` halts Web Animations during capture;
    // `scale: 'css'` guarantees 1440×900 physical pixels on HiDPI runners.
    const captured = await page.screenshot({
      fullPage: false,
      type: 'png',
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      mask: [page.getByTestId('stage')],
      maskColor: '#000000',
    });

    expect(captured).toMatchSnapshot('design-rework-reference.png', {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    });
  });
});
