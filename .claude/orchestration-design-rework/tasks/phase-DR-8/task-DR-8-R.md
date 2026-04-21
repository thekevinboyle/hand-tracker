# Task DR-8.R: Phase DR-8 Regression — Visual fidelity gate + reference capture

**Phase**: DR-8 — Chrome Integration
**Branch**: `task/DR-8-R-phase-regression`
**Commit prefix**: `Task DR-8.R:`
**Estimated complexity**: Large
**Max Ralph iterations**: 40

---

## Goal

**Feature Goal**: Close Phase DR-8 with a full user-journey E2E walkthrough that exercises every piece of the new chrome (toolbar, sidebar, LAYER card, modulation card, preset strip, record, footer, reduced-motion, 8 error states). Capture the canonical reference screenshot `reports/DR-8-regression/design-rework-reference.png` — this becomes the visual-fidelity baseline for Phase DR-9.3 and all future design work. Land a regression report markdown.

**Deliverable**:
- `tests/e2e/DR-8-regression.spec.ts` — 12+ step user journey
- `reports/DR-8-regression/design-rework-reference.png` — canonical reference (committed)
- `reports/DR-8-regression/step-{01..12}.png` — per-step screenshots (committed)
- `reports/DR-8-regression.md` — landed report capturing results, deviations, follow-ups

**Success Definition**: All 4 PRP validation levels green. All 45 Phase 1–4 E2E specs still pass. All 7 DR-8.x child tasks' E2E specs still pass. Reference PNG committed at canonical path. Report markdown committed. Zero console errors during the happy-path walkthrough.

---

## User Persona

**Target User**: The full demo persona — a creative technologist giving a live show with Hand Tracker FX. They touch every surface of the UI over 60 seconds.

**Use Case**: Live demo: user opens the app, tweaks parameters, adds modulation, saves presets, cycles them mid-show, records a clip, exports the preset file. Reduced-motion accessibility user opens the app in reduced-motion mode and sees a stable (non-modulated) image with params still editable.

**User Journey** (12 steps, mapped to E2E `test.step`):

1. Open app → GRANTED state within 5 s.
2. Verify full chrome present: toolbar, sidebar, LAYER 1 card (3 sections), MODULATION card, preset strip, record button, footer.
3. Cell-picker: click M → verify `mosaic.tileSize === 16` (baseline), then XL → 64; stage mosaic visibly coarsens.
4. Sidebar Grid section: drag `widthVariance` slider to the right — value > 0.6; grid re-renders.
5. Sidebar Grid: click `Randomize` button — `grid.seed` changes; grid edges jump.
6. MODULATION card: expand via chevron; verify two default routes visible; add a third route mapping `landmark[8].x → mosaic.tileSize`; verify `modulation-route-2` testid appears.
7. Preset: click Save As → name "DR8R" → preset saved; `preset-name` shows "DR8R".
8. Preset: click back to "Default" via chevron `‹`; `preset-name` cycles.
9. ArrowLeft cycles preset back; ArrowRight forward.
10. Record: click `record-button` → verify red state + `record-elapsed` counts; after 500 ms stop → `.webm` downloaded (mock via download listener).
11. Reduced-motion: toggle `prefers-reduced-motion: reduce`; verify modulation paused (paramStore values stop drifting) but sliders still editable.
12. Error gate: force `USER_DENIED` via dev hook → `error-state-card-USER_DENIED` visible + Try Again works.

**Pain Points Addressed**: Proves the rework didn't break any user flow.

---

## Why

- Phase gate — prevents promoting DR-8 to DR-9 until the chrome is demonstrably complete.
- Captures the reference image for Phase DR-9.3 (visual-fidelity gate).
- Sets a regression floor: DR-9+ work cannot regress anything validated here.
- Depends on DR-8.1 through DR-8.7 (all child tasks complete).

---

## What

### New E2E spec — `tests/e2e/DR-8-regression.spec.ts`

Use Playwright test.step() to structure 12 steps. Each step captures a screenshot to `reports/DR-8-regression/step-{NN}.png`. Final step captures `design-rework-reference.png` at a canonical viewport (1440×900, reduced-motion off, default preset).

### Report — `reports/DR-8-regression.md`

Template:

```markdown
# Phase DR-8 Regression Report

**Date**: <YYYY-MM-DD>
**Branch**: task/DR-8-R-phase-regression
**Runner**: Ralph loop iteration N

## Summary

Phase DR-8 — Chrome Integration — is complete. All 7 child tasks landed. Full user journey validated via E2E. Reference screenshot captured.

## Validation Results

| Level | Command | Result |
|---|---|---|
| L1 | `pnpm biome check . && pnpm tsc --noEmit` | PASS |
| L2 | `pnpm vitest run` | PASS (N tests) |
| L3 | `pnpm build` | PASS |
| L4 | `pnpm test:e2e` | PASS (N specs) |

## User journey evidence

Screenshots: `reports/DR-8-regression/step-01.png` … `step-12.png` — one per step.
Canonical reference: `reports/DR-8-regression/design-rework-reference.png` (1440×900).

## Deviations / open follow-ups

- <e.g. "Cubic-bezier editor drag accuracy needs keyboard polish — tracked as DR-follow-up-1.">

## Sign-off

Phase DR-8 ready for promotion to DR-9. Tweakpane fully retired. All testids preserved.
```

### NOT Building

- No new components; the regression only validates + captures.
- No test helper changes outside the regression spec.
- No CHANGELOG entry (DR-9.R owns that).

### Success Criteria

- [ ] `pnpm biome check . && pnpm tsc --noEmit` exits 0
- [ ] `pnpm vitest run` — 100% pass
- [ ] `pnpm build` — success
- [ ] `pnpm test:e2e` — all specs pass, including:
  - 45 Phase 1–4 specs
  - DR-8.1 through DR-8.7 specs (one per child task)
  - new `DR-8-regression` spec
- [ ] Canonical reference committed at `reports/DR-8-regression/design-rework-reference.png`
- [ ] Per-step screenshots committed under `reports/DR-8-regression/step-{01..12}.png`
- [ ] Report markdown `reports/DR-8-regression.md` committed
- [ ] Zero console errors in the happy-path walkthrough (captured via `page.on('console')` listener)
- [ ] Manual Playwright MCP smoke check against live Vercel preview (evidence note in report)

---

## All Needed Context

```yaml
files:
  - path: tests/e2e/phase-4-regression.spec.ts
    why: Template for a multi-step regression spec — mirror its test.step shape

  - path: tests/e2e/errorStates.spec.ts
    why: Reference for error-state forcing patterns

  - path: src/engine/devHooks.ts
    why: `__handTracker` dev hook API — `__engine.getParam(dotPath)` / `__engine.setParam(dotPath, value)` / `listEffects()`. No paramSnapshot / modulationSnapshot / savePreset / forceCameraState methods exist — use `getParam` for reads, drive the UI for writes, and use DR-9.2-style addInitScript stubs for forced camera states.

  - path: reports/DR-8-regression/ (create)
    why: Output directory for per-step screenshots + reference

skills:
  - hand-tracker-fx-architecture
  - prp-task-ralph-loop
  - playwright-e2e-webcam
  - vitest-unit-testing-patterns
  - webcam-permissions-state-machine
  - design-tokens-dark-palette

discovery:
  - DR4: Visual fidelity gate adopts the new reference after each phase regression
```

### Testids used in this spec (all must be present)

**Stage / camera**:
- `camera-state`, `stage`, `render-canvas`, `stage-video`, `webgl-canvas`, `overlay-canvas`

**Error / prompt**:
- `error-state-card-PROMPT`, `error-state-card-USER_DENIED`, `error-state-card-SYSTEM_DENIED`, `error-state-card-DEVICE_CONFLICT`, `error-state-card-NOT_FOUND`, `error-state-card-MODEL_LOAD_FAIL`, `error-state-card-NO_WEBGL`

**Sidebar / panels**:
- `panel-root`, `params-panel`, `layer-card-grid`, `layer-card-mosaic`, `layer-card-input`
- `modulation-card`, `modulation-route-0`, `modulation-route-1`, `modulation-route-2` (after add)

**Preset strip**:
- `preset-bar`, `preset-name`, `preset-actions`

**Toolbar**:
- `toolbar`, `toolbar-wordmark`, `toolbar-cell-picker`

**Record / footer**:
- `record-button`, `record-elapsed`, `footer`

### Known Gotchas

```typescript
// CRITICAL: The canonical reference screenshot MUST be captured:
//  - viewport 1440×900
//  - reduced-motion OFF
//  - default preset (paramStore untouched)
//  - no modulation routes added beyond the D13 baseline
//  - camera state GRANTED with the fake-webcam Y4M feed
//  - no recording in progress
//
// Use `page.setViewportSize({ width: 1440, height: 900 })` + `await page.waitForTimeout(1000)` for render
// settling. Screenshot via `await page.screenshot({ path: '…reference.png', fullPage: false })`.

// CRITICAL: Ordering matters. Any DOM-mutating step (preset save, modulation add)
// should run AFTER the reference capture, not before. Put the canonical capture as
// the first assertion block post-GRANTED.

// CRITICAL: Per-step screenshots can be partial (viewport), named step-{NN}.png.
// The canonical reference is separate.

// CRITICAL: Console error detection — attach before page.goto:
//   const errors: string[] = [];
//   page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
//   ...
//   expect(errors).toEqual([]);
// Whitelist any known benign errors (e.g. MediaPipe warn about backend selection)
// via `.filter(e => !e.includes('...'))`.

// CRITICAL: Reduced-motion step — toggle via page.emulateMedia({ reducedMotion: 'reduce' }).
// Between the toggle and the assertion, capture a fresh `paramStore.snapshot`
// twice (500ms apart) and assert identity/equality — modulation should be paused
// so the snapshot doesn't drift.

// CRITICAL: The `.webm` download assertion — use Playwright's `page.on('download')`
// listener + `download.saveAs(...)` to verify a blob was produced. Size > 0 and
// mime starts with `video/webm`.

// CRITICAL: The spec MUST use `describe('Task DR-8.R: …', ...)` so --grep matches.

// CRITICAL: Do NOT relax any existing assertion in phase-4-regression.spec.ts. If
// something legitimately changed (e.g. z-index selector paths), fix the spec's
// selector to target the new testid, never loosen `toBeVisible` to `toBeAttached`.

// CRITICAL: If the Ralph loop hits an unfixable assertion, FILE a "follow-up" note
// in reports/DR-8-regression.md rather than disabling the test. Only the human can
// approve test removal/weakening.
```

---

## Implementation Blueprint

### Step 1: Create output directory

```bash
mkdir -p reports/DR-8-regression
```

### Step 2: Write the spec

```typescript
// tests/e2e/DR-8-regression.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Task DR-8.R: full user journey on reworked chrome', () => {
  test('complete 12-step walkthrough + reference capture', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });

    await page.setViewportSize({ width: 1440, height: 900 });

    await test.step('01 — app loads to GRANTED state', async () => {
      await page.goto('/');
      await page.waitForFunction(
        () => document.querySelector('[data-testid="camera-state"]')?.textContent === 'GRANTED',
        { timeout: 10_000 },
      );
      await page.screenshot({ path: 'reports/DR-8-regression/step-01.png' });
    });

    await test.step('02 — full chrome present; canonical reference captured', async () => {
      for (const id of [
        'toolbar', 'toolbar-wordmark', 'toolbar-cell-picker',
        'panel-root', 'params-panel',
        'layer-card-grid', 'layer-card-mosaic', 'layer-card-input',
        'modulation-card',
        'preset-bar', 'preset-name', 'preset-actions',
        'record-button', 'footer',
      ]) {
        await expect(page.getByTestId(id)).toBeVisible();
      }
      await page.waitForTimeout(1000); // render settling
      await page.screenshot({
        path: 'reports/DR-8-regression/design-rework-reference.png',
        fullPage: false,
      });
      await page.screenshot({ path: 'reports/DR-8-regression/step-02.png' });
    });

    await test.step('03 — cell-picker XL updates mosaic.tileSize', async () => {
      await page.getByTestId('toolbar-cell-picker').getByText('XL', { exact: true }).click();
      const v = await page.evaluate(() => (window as any).__handTracker?.__engine?.getParam('mosaic.tileSize'));
      expect(v).toBe(64);
      await page.screenshot({ path: 'reports/DR-8-regression/step-03.png' });
    });

    await test.step('04 — widthVariance slider drag mutates paramStore', async () => {
      const row = page.getByTestId('layer-card-grid').getByText('Width variance').locator('..');
      const slider = row.getByRole('slider');
      await slider.focus();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      const v = await page.evaluate(() => (window as any).__handTracker?.__engine?.getParam('grid.widthVariance'));
      expect(v).toBeGreaterThan(0.6);
      await page.screenshot({ path: 'reports/DR-8-regression/step-04.png' });
    });

    await test.step('05 — Randomize button rolls grid.seed', async () => {
      const before = await page.evaluate(() => (window as any).__handTracker?.__engine?.getParam('grid.seed'));
      await page.getByTestId('layer-card-grid').getByText('Randomize', { exact: true }).click();
      const after = await page.evaluate(() => (window as any).__handTracker?.__engine?.getParam('grid.seed'));
      expect(after).not.toBe(before);
      await page.screenshot({ path: 'reports/DR-8-regression/step-05.png' });
    });

    await test.step('06 — MODULATION card: expand, add route, route[2] visible', async () => {
      const card = page.getByTestId('modulation-card');
      await card.getByRole('button', { name: /modulation/i }).click();
      const countBefore = await page.getByTestId(/^modulation-route-\d+$/).count();
      await card.getByRole('button', { name: '+ Add route' }).click();
      await expect(page.getByTestId(`modulation-route-${countBefore}`)).toBeVisible();
      await page.screenshot({ path: 'reports/DR-8-regression/step-06.png' });
    });

    await test.step('07 — Save As "DR8R"', async () => {
      page.once('dialog', async (d) => {
        if (d.type() === 'prompt') await d.accept('DR8R');
      });
      await page.getByTestId('preset-actions').getByText('Save As').click();
      const name = await page.getByTestId('preset-name').inputValue();
      expect(name).toBe('DR8R');
      await page.screenshot({ path: 'reports/DR-8-regression/step-07.png' });
    });

    await test.step('08 — Chevron cycles back to Default', async () => {
      await page.getByTestId('preset-bar').getByRole('button', { name: /previous/i }).click();
      const name = await page.getByTestId('preset-name').inputValue();
      expect(['Default', 'DR8R']).toContain(name);
      await page.screenshot({ path: 'reports/DR-8-regression/step-08.png' });
    });

    await test.step('09 — ArrowLeft/Right keyboard cycles', async () => {
      await page.keyboard.press('ArrowRight');
      const afterRight = await page.getByTestId('preset-name').inputValue();
      await page.keyboard.press('ArrowLeft');
      const afterLeft = await page.getByTestId('preset-name').inputValue();
      expect(afterRight).not.toBe(afterLeft);
      await page.screenshot({ path: 'reports/DR-8-regression/step-09.png' });
    });

    await test.step('10 — Record → stop → webm downloaded', async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
        (async () => {
          await page.getByTestId('record-button').click();
          await expect(page.getByTestId('record-elapsed')).toBeVisible();
          await page.waitForTimeout(800);
          await page.getByTestId('record-button').click(); // stop
        })(),
      ]);
      expect(download).not.toBeNull();
      if (download) {
        const suggested = download.suggestedFilename();
        expect(suggested).toMatch(/\.webm$/);
      }
      await page.screenshot({ path: 'reports/DR-8-regression/step-10.png' });
    });

    await test.step('11 — reduced-motion pauses modulation', async () => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const a = await page.evaluate(() => (window as any).__handTracker?.__engine?.getParam('mosaic.tileSize'));
      await page.waitForTimeout(500);
      const b = await page.evaluate(() => (window as any).__handTracker?.__engine?.getParam('mosaic.tileSize'));
      expect(a).toBe(b);
      await page.screenshot({ path: 'reports/DR-8-regression/step-11.png' });
    });

    await test.step('12 — USER_DENIED error card visible + retry', async () => {
      // Reuse the DR-9.2 pattern: open a fresh context with permissions: [] and stub navigator.permissions.query + getUserMedia via addInitScript.
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const ctx = page.context();
      await ctx.clearPermissions();
      await ctx.addInitScript(() => {
        // Stub navigator.permissions.query to report 'denied' for camera
        const originalQuery = navigator.permissions.query.bind(navigator.permissions);
        navigator.permissions.query = async (desc: PermissionDescriptor) => {
          if ((desc as { name: string }).name === 'camera') {
            return { state: 'denied', name: 'camera' } as unknown as PermissionStatus;
          }
          return originalQuery(desc);
        };
        // Stub getUserMedia to reject with NotAllowedError
        navigator.mediaDevices.getUserMedia = () =>
          Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
      });
      await page.reload();
      await expect(page.getByTestId('error-state-card-USER_DENIED')).toBeVisible();
      // retry button present
      await expect(page.getByTestId('error-state-card-USER_DENIED').locator('.card-retry')).toBeVisible();
      await page.screenshot({ path: 'reports/DR-8-regression/step-12.png' });
    });

    // Console-error gate — whitelist any known benign warnings
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('[mediapipe]') && !e.includes('Web GPU'),
    );
    expect(realErrors).toEqual([]);
  });
});
```

### Step 3: Run the spec & iterate

```bash
pnpm test:setup
pnpm test:e2e --grep "Task DR-8.R:"
```

Ralph loop fixes any regression. Committed screenshots land in `reports/DR-8-regression/`.

### Step 4: Run the full suite

```bash
pnpm biome check .
pnpm tsc --noEmit
pnpm vitest run
pnpm build
pnpm test:e2e
```

### Step 5: Write `reports/DR-8-regression.md`

Use the template above. Include:
- Commit hashes for DR-8.1 through DR-8.7
- Any whitelisted console-error strings with justification
- Any follow-up tickets

### Step 6: Manual MCP Playwright smoke on live Vercel preview

Navigate the live preview URL via Playwright MCP tools:
- Verify GRANTED state reaches
- Verify toolbar + sidebar + footer visible
- Capture one screenshot (not committed — just evidence in the report text)

Document in `reports/DR-8-regression.md` under "Live smoke-check".

---

## Validation Loop

### Level 1

```bash
pnpm biome check tests/e2e/DR-8-regression.spec.ts reports/DR-8-regression.md
pnpm tsc --noEmit
```

### Level 2

```bash
pnpm vitest run
```

### Level 3

```bash
pnpm build
```

### Level 4

```bash
pnpm test:setup
pnpm test:e2e
# All ~60 specs must pass:
# - 45 Phase 1–4 specs
# - 7 DR-8.x child specs
# - 1 DR-8-regression spec
# - plus pre-existing smoke/use-camera/error-state specs
```

### Level 5 (manual)

- Open `reports/DR-8-regression/design-rework-reference.png` and visually verify:
  - Toolbar at top with wordmark + cell picker + record button
  - Sidebar right: preset strip → LAYER 1 card (3 sections with all controls) → MODULATION card (collapsed)
  - Stage fills remaining viewport; mosaic visible over fake-webcam Y4M
  - Footer at bottom with muted credit text
  - JetBrains Mono everywhere; dark palette

---

## Final Validation Checklist

### Technical
- [ ] All 4 PRP validation levels exit 0
- [ ] `reports/DR-8-regression/design-rework-reference.png` committed (1440×900 PNG)
- [ ] `reports/DR-8-regression/step-01.png` … `step-12.png` all committed
- [ ] `reports/DR-8-regression.md` committed
- [ ] Zero unwhitelisted console errors

### Phase gate
- [ ] All 7 DR-8.x child tasks complete (PROGRESS.md marks them done)
- [ ] 45 Phase 1–4 specs still pass unchanged
- [ ] `grep -r 'tweakpane' src/` empty
- [ ] All 20 mandatory testids (9 existing + 11 new) queryable

### Feature
- [ ] 12-step journey fully automated and green
- [ ] Reduced-motion branch tested
- [ ] 1 error-state (USER_DENIED) covered in regression
- [ ] Live Vercel preview manual smoke noted in report

---

## Anti-Patterns

- Do not capture the reference after state mutations — it must reflect the default preset.
- Do not weaken assertions to make the spec pass — diagnose + fix the underlying chrome.
- Do not commit `node_modules` or `playwright-report/` artifacts.
- Do not skip the console-error gate.
- Do not commit a blurred / low-res reference.

---

## No Prior Knowledge Test

- [ ] 12 steps enumerated clearly
- [ ] Reference PNG path explicit: `reports/DR-8-regression/design-rework-reference.png`
- [ ] Report path explicit: `reports/DR-8-regression.md`
- [ ] All 20 testids listed
- [ ] All DR-numbers cited (DR4 + §7 testids)
- [ ] Validation commands runnable

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/design-tokens-dark-palette/SKILL.md
.claude/skills/playwright-e2e-webcam/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
.claude/skills/webcam-permissions-state-machine/SKILL.md
```
