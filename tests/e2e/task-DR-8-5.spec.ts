/**
 * Task DR-8.5: PresetStrip — Playwright E2E.
 *
 * Exercises the merged `<PresetStrip>` (PresetBar + PresetActions
 * collapsed into one horizontal strip in the sidebar header) via the
 * committed 'pnpm build --mode test && pnpm preview' webServer.
 *
 * Coverage:
 *   1. Strip + all three testids (preset-bar, preset-name, preset-actions)
 *      visible once camera is GRANTED
 *   2. Save As via `window.prompt` seeds a new preset + updates the name
 *      input (UI-driven per CRITICAL-03 — NO `__handTracker.savePreset()`)
 *   3. ArrowRight after the new preset exists cycles forward
 *   4. ArrowLeft cycles back
 *   5. Delete confirms via `window.confirm` and removes the preset from
 *      storage (count decreases) — confirms the strip's CRUD plumbing is
 *      wired end-to-end, not stubbed
 *
 * Describe prefix MUST start with literal `Task DR-8.5:` so
 * `--grep "Task DR-8.5:"` resolves these tests only.
 */

import { expect, test } from '@playwright/test';

async function grant(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('camera-state')).toHaveText('GRANTED', { timeout: 30_000 });
}

async function presetCount(page: import('@playwright/test').Page): Promise<number> {
  return await page.evaluate(() => {
    const raw = window.localStorage.getItem('hand-tracker-fx:presets:v1');
    if (!raw) return 0;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  });
}

test.describe('Task DR-8.5: PresetStrip — sidebar header + UI-driven CRUD', () => {
  test('strip rendered inside sidebar with all three testids visible', async ({ page }) => {
    await grant(page);
    const strip = page.getByTestId('preset-bar');
    await expect(strip).toBeVisible();
    await expect(page.getByTestId('preset-name')).toBeVisible();
    await expect(page.getByTestId('preset-actions')).toBeVisible();
    // Sanity: the strip lives inside the sidebar (panel-root), not floating.
    const insideSidebar = await page.evaluate(() => {
      const bar = document.querySelector('[data-testid="preset-bar"]');
      const panel = document.querySelector('[data-testid="panel-root"]');
      return !!bar && !!panel && panel.contains(bar);
    });
    expect(insideSidebar).toBe(true);
  });

  test('Save As (UI-driven) seeds a new preset and updates the name input', async ({ page }) => {
    await grant(page);
    const before = await presetCount(page);
    page.once('dialog', (d) => {
      void d.accept('DR-8-5-SaveAs');
    });
    await page.getByTestId('preset-actions').getByRole('button', { name: 'Save As' }).click();
    await expect(page.getByTestId('preset-name')).toHaveValue('DR-8-5-SaveAs');
    const after = await presetCount(page);
    expect(after).toBeGreaterThan(before);
  });

  test('ArrowRight / ArrowLeft cycle presets once multiple presets exist', async ({ page }) => {
    await grant(page);
    // Seed TWO additional presets via the UI so Default + Alpha + Beta all
    // live in storage. The cycler starts at currentIndex=0 (Default); we
    // want an intermediate preset at index 1 that's DIFFERENT from the
    // strip's visible name after Save As, so cycling through all three
    // demonstrably moves the input value between distinct strings.
    page.once('dialog', (d) => {
      void d.accept('DR-8-5-Alpha');
    });
    await page.getByTestId('preset-actions').getByRole('button', { name: 'Save As' }).click();
    await expect(page.getByTestId('preset-name')).toHaveValue('DR-8-5-Alpha');
    page.once('dialog', (d) => {
      void d.accept('DR-8-5-Beta');
    });
    await page.getByTestId('preset-actions').getByRole('button', { name: 'Save As' }).click();
    await expect(page.getByTestId('preset-name')).toHaveValue('DR-8-5-Beta');

    // Focus must NOT be on the preset-name input — the input-target guard
    // would swallow the Arrow keys (by design, so the caret moves normally).
    await page.locator('body').click({ position: { x: 5, y: 5 } });

    // Cycler currentIndex is still 0 (Default). Visible name is 'DR-8-5-Beta'.
    // ArrowRight → index 1 → DR-8-5-Alpha (distinct from both start names).
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('preset-name')).toHaveValue('DR-8-5-Alpha');
    // ArrowLeft → back to index 0 → Default.
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('preset-name')).toHaveValue('Default');
  });

  test('input-target guard: ArrowRight inside the preset-name input does NOT cycle', async ({
    page,
  }) => {
    await grant(page);
    // Seed a second preset so cycling is possible if the guard fails.
    page.once('dialog', (d) => {
      void d.accept('DR-8-5-Guard');
    });
    await page.getByTestId('preset-actions').getByRole('button', { name: 'Save As' }).click();
    await expect(page.getByTestId('preset-name')).toHaveValue('DR-8-5-Guard');
    const nameInput = page.getByTestId('preset-name');
    await nameInput.click();
    await nameInput.press('ArrowRight');
    // Guard triggers: name value must stay put (no cycle occurred).
    await expect(nameInput).toHaveValue('DR-8-5-Guard');
  });

  test('Delete (UI-driven) decreases the preset count', async ({ page }) => {
    await grant(page);
    // Seed a fresh preset so we have something deletable without nuking the
    // Default seed (which main.tsx re-initialises on load anyway).
    page.once('dialog', (d) => {
      void d.accept('DR-8-5-Delete');
    });
    await page.getByTestId('preset-actions').getByRole('button', { name: 'Save As' }).click();
    await expect(page.getByTestId('preset-name')).toHaveValue('DR-8-5-Delete');
    const beforeDelete = await presetCount(page);

    page.once('dialog', (d) => {
      // Delete flow uses window.confirm — accept it.
      void d.accept();
    });
    await page.getByTestId('preset-actions').getByRole('button', { name: 'Delete' }).click();
    const afterDelete = await presetCount(page);
    expect(afterDelete).toBe(beforeDelete - 1);
  });
});
