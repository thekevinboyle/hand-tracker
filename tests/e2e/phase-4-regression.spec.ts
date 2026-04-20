/**
 * Phase 4 regression - Task 4.R.
 *
 * Exercises the combined Phase 4 pipeline (Tasks 4.1-4.6) against the
 * committed 'pnpm build --mode test && pnpm preview' webServer. Covers:
 *   1. GRANTED + default preset loads (D30)
 *   2. Modulation drives mosaic.tileSize when landmark[8].x spikes (D13)
 *   3. Save As persists a new preset + chevron / Arrow cycling (D11, D30)
 *   4. Record to .webm download (D28)
 *   5. prefers-reduced-motion pauses modulation (D26)
 *
 * Adapts to the actual window.__handTracker.__engine surface (no new
 * window.__test__ namespace needed). Captures 6 PNG walkthrough artifacts
 * under reports/phase-4-walkthrough/ (gitignored via reports/** PNG rule).
 *
 * Describe prefix MUST start with literal `Task 4.R:` so
 * `--grep "Task 4.R:"` resolves these tests only.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const SHOT_DIR = 'reports/phase-4-walkthrough';

interface EngineHook {
  getParam?: (dotPath: string) => unknown;
  setParam?: (dotPath: string, value: unknown) => void;
  setFakeLandmarks?: (
    lms: Array<{ x: number; y: number; z: number; visibility?: number }> | null,
  ) => void;
  getLastRegionCount?: () => number;
}

interface HandTrackerHook {
  __engine?: EngineHook;
}

function landmarksAt(idx8: { x: number; y: number }): Array<{
  x: number;
  y: number;
  z: number;
  visibility: number;
}> {
  // 21 landmarks — only index 8 (index-finger tip) matters for D13's default
  // mosaic.tileSize route; set every other landmark to a filler centre so
  // they don't accidentally interfere with future modulation sources.
  const out = Array.from({ length: 21 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1,
  }));
  out[8] = { x: idx8.x, y: idx8.y, z: 0, visibility: 1 };
  return out;
}

async function snap(page: Page, step: number, label: string): Promise<void> {
  await fs.mkdir(SHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(SHOT_DIR, `step-${String(step).padStart(2, '0')}-${label}.png`),
    fullPage: false,
  });
}

test.describe('Task 4.R: Phase 4 regression — modulation + presets + record + reduced-motion', () => {
  test('end-to-end Phase 4 user flow', async ({ page }) => {
    // Capture console errors across the entire run so the final assertion
    // surfaces anything the app logs mid-flight.
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
    });

    // Step 1 — initial load, GRANTED, default preset (Default) visible.
    await page.goto('/');
    await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 30_000 });
    await page.waitForFunction(
      () => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        return typeof w.__handTracker?.__engine?.setFakeLandmarks === 'function';
      },
      undefined,
      { timeout: 10_000 },
    );
    // PresetStrip + default preset visible.
    // (DR-8.5 merged PresetBar + PresetActions into a single `<PresetStrip>`.
    // `preset-name` is now an editable <input>, so read it with inputValue()
    // instead of textContent(). The `preset-bar` testid migrates to the
    // strip root; CRITICAL-03 keeps this contract unchanged.)
    await expect(page.getByTestId('preset-bar')).toBeVisible();
    await expect(page.getByTestId('preset-name')).toHaveValue('Default');
    await snap(page, 1, 'initial-load');

    // Step 2 — modulation drives mosaic.tileSize when landmark[8].x = 0.9.
    // D13 default route maps [0, 1] → [4, 64] linear + integer-rounded.
    // At x=0.9 we expect tileSize ≈ 58. Allow a wide floor (>40) to
    // tolerate clamp/rounding variations across runs.
    await page.evaluate(
      (lms) => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        w.__handTracker?.__engine?.setFakeLandmarks?.(lms);
      },
      landmarksAt({ x: 0.9, y: 0.1 }),
    );
    await page.waitForFunction(
      () => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        const t = w.__handTracker?.__engine?.getParam?.('mosaic.tileSize');
        return typeof t === 'number' && t > 40;
      },
      undefined,
      { timeout: 10_000 },
    );
    const tileHigh = (await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      return w.__handTracker?.__engine?.getParam?.('mosaic.tileSize');
    })) as number;
    expect(tileHigh, 'landmark[8].x=0.9 should drive tileSize near upper bound').toBeGreaterThan(
      48,
    );
    expect(tileHigh).toBeLessThanOrEqual(64);
    await snap(page, 2, 'modulation-live');

    // Step 3 — Save As "Phase4-Test". PresetStrip (DR-8.5) uses
    // `window.prompt`; Playwright's dialog handler accepts it with the
    // desired name.
    page.once('dialog', (d) => {
      void d.accept('Phase4-Test');
    });
    await page.getByRole('button', { name: 'Save As' }).click();
    // Current name input reflects the saved preset.
    const currentNameInput = page.getByRole('textbox', { name: 'Current preset name' });
    await expect(currentNameInput).toHaveValue('Phase4-Test');
    await snap(page, 3, 'preset-saved');

    // Step 4 — cycle forward to the new preset via the right chevron.
    await page.getByRole('button', { name: 'Next preset' }).click();
    // After cycleNext, presetCycler fires onChange; the PresetStrip re-renders.
    // The new preset is at the end of the list so after the first click the
    // bar shows the next preset alphabetically (storage order). Accept any
    // name that reflects the cycler actually advanced — a strict match is
    // brittle across test runs that leave presets in storage.
    // (DR-8.5: `preset-name` is now an <input>; read via inputValue().)
    const nameAfterNext = await page.getByTestId('preset-name').inputValue();
    expect(nameAfterNext).not.toBe('Default');
    await snap(page, 4, 'preset-cycled');

    // Step 5 — ArrowLeft returns to the prior preset. Clear focus first so
    // the window keydown listener (not the preset-name input) receives the
    // key — the input-target guard in PresetStrip would otherwise swallow it.
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('ArrowLeft');
    const nameAfterLeft = await page.getByTestId('preset-name').inputValue();
    expect(nameAfterLeft).not.toBe(nameAfterNext);

    // Step 6 — Record button: start → wait ~1.5 s → stop → .webm download.
    const recordBtn = page.getByRole('button', { name: 'Start recording' });
    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
    await recordBtn.click();
    await expect(page.getByRole('button', { name: 'Stop recording' })).toBeVisible();
    await snap(page, 5, 'recording');
    await page.waitForTimeout(1_500);
    await page.getByRole('button', { name: 'Stop recording' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^hand-tracker-fx-.*\.webm$/);
    expect(download.suggestedFilename()).not.toContain(':');

    // Step 7 — prefers-reduced-motion pauses modulation (D26). Capture the
    // current tileSize, flip the media query, then inject different
    // landmarks that would normally drive tileSize to the opposite end of
    // the range. Assert tileSize is unchanged — modulation is paused.
    await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      w.__handTracker?.__engine?.setFakeLandmarks?.(null);
    });
    // Settle to a known tileSize before flipping reduced-motion.
    await page.evaluate(
      (lms) => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        w.__handTracker?.__engine?.setFakeLandmarks?.(lms);
      },
      landmarksAt({ x: 0.5, y: 0.5 }),
    );
    await page.waitForTimeout(500);
    const tileBeforeRM = (await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      return w.__handTracker?.__engine?.getParam?.('mosaic.tileSize');
    })) as number;

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(300); // Allow matchMedia change → listener to fire.

    // Inject landmarks that would drive tileSize away from tileBeforeRM.
    const targetX = tileBeforeRM > 32 ? 0.05 : 0.95;
    await page.evaluate(
      (lms) => {
        const w = window as unknown as { __handTracker?: HandTrackerHook };
        w.__handTracker?.__engine?.setFakeLandmarks?.(lms);
      },
      landmarksAt({ x: targetX, y: 0.5 }),
    );
    await page.waitForTimeout(600); // Several render ticks.

    const tileAfterRM = (await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      return w.__handTracker?.__engine?.getParam?.('mosaic.tileSize');
    })) as number;
    expect(
      tileAfterRM,
      `reduced-motion should pause modulation (before=${tileBeforeRM}, after=${tileAfterRM})`,
    ).toBe(tileBeforeRM);
    await snap(page, 6, 'reduced-motion');

    // Clean up injected landmarks so subsequent Playwright tests in the
    // same session start fresh.
    await page.evaluate(() => {
      const w = window as unknown as { __handTracker?: HandTrackerHook };
      w.__handTracker?.__engine?.setFakeLandmarks?.(null);
    });

    // Final hygiene check — no console errors leaked across the run.
    expect(errors, `console errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
