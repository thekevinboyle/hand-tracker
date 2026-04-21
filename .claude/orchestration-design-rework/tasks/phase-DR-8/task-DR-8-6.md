# Task DR-8.6: Wire App.tsx to new chrome + retire Tweakpane

**Phase**: DR-8 — Chrome Integration
**Branch**: `task/DR-8-6-app-wire-retire-tweakpane`
**Commit prefix**: `Task DR-8.6:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 25

---

## Goal

**Feature Goal**: Finish the chrome swap. `App.tsx` renders the new composition — `<Toolbar> + <Stage> + <Sidebar>` — wiring `<ModulationCard />` into the sidebar's `modulationSlot` and `<PresetStrip />` into its `presetStripSlot`. Delete `src/ui/Panel.tsx` and `src/engine/buildPaneFromManifest.ts`. Remove the three Tweakpane dependencies from `package.json` + `pnpm-lock.yaml`. Update `main.tsx` to drop the Tweakpane-specific scaffolding (`paneRef` + `PresetCycler.refresh()` ordering notes can stay; `paneRef` concept goes away).

**Deliverable**:
- `src/App.tsx` — rewritten composition
- `src/main.tsx` — minor tweaks (comments clarify Tweakpane retirement)
- **DELETE** `src/ui/Panel.tsx` + `src/ui/Panel.test.tsx`
- **DELETE** `src/engine/buildPaneFromManifest.ts` + `src/engine/buildPaneFromManifest.test.ts`
- `package.json` — remove `tweakpane`, `@tweakpane/core` (if present), `@tweakpane/plugin-essentials`
- `pnpm-lock.yaml` — regenerated
- `src/ui/PresetCycler.ts` — simplify signature to drop `pane?: Pane` arg (now unused)
- `src/ui/PresetStrip.tsx` — simplify: drop `paneRef` prop
- `tests/e2e/task-DR-8-6.spec.ts` — Playwright L4

**Success Definition**: `grep -r 'tweakpane' src/` returns zero hits (excluding retirement-commit-message comments). `pnpm build` still passes. App renders with the new chrome only. All 45 Phase 1–4 E2E specs still pass.

---

## User Persona

**Target User**: Any user of the app. This task is invisible to them beyond "the panel looks different" — all behavior preserved.

**Use Case**: Same as Phase 4 final cut — user sees camera, tweaks params via new sidebar, records, saves preset. Every interaction still works.

**User Journey**: Unchanged from Phase 4 journey. Single additional observation: no Tweakpane pane visible.

**Pain Points Addressed**: Closes the design rework loop. The site is 100% the new chrome; the 2.8MB of Tweakpane+essentials is gone from the bundle.

---

## Why

- DR3 — Replace Tweakpane entirely; remove runtime dependency.
- Depends on DR-8.1 (Toolbar), DR-8.2 (Sidebar + LayerCard1), DR-8.3 (ModulationCard), DR-8.5 (PresetStrip). DR-8.4 + DR-8.7 run independently but DR-8.6 must coexist with both.
- Unblocks DR-8.7 (Footer added around the new composition) and DR-8.R (final regression).

---

## What

### App composition (before)

```tsx
<main className="app-shell">
  <p data-testid="camera-state" />
  {PROMPT && <PrePromptCard />}
  {ERROR && <ErrorStates />}
  {GRANTED && (
    <>
      <Stage />
      <Panel manifest={...} paneRef={paneRef} />
      <PresetBar paneRef={paneRef} />
      <RecordButton />
    </>
  )}
</main>
```

### App composition (after)

```tsx
<main className="app-shell">
  <p data-testid="camera-state" />
  {PROMPT && <PrePromptCard />}
  {ERROR && <ErrorStates />}
  {GRANTED && (
    <div className="app-layout">
      <Toolbar getCanvas={() => stageRef.current?.overlayCanvas ?? null} />
      <div className="app-body">
        <Stage ... />
        <Sidebar
          presetStripSlot={<PresetStrip />}
          modulationSlot={<ModulationCard />}
        />
      </div>
    </div>
  )}
</main>
```

Where `.app-layout` is `display: flex; flex-direction: column; height: 100vh` and `.app-body` is `display: flex; flex-direction: row; flex: 1 1 0; min-height: 0`.

This replaces Stage.tsx's historical "fixed inset 0" with a flex-flow layout — Stage is `flex: 1 1 0; min-width: 0; position: relative`; its canvases stay absolute-positioned relative to Stage. This change requires a small Stage.css edit (use `position: relative` or wrap Stage in a container). If Stage.css edits are avoided, leave Stage as-is and just overlay — the toolbar's height consumes the top, the sidebar is a right-anchored `position: fixed` column. Prefer the flex refactor for cleanliness.

### Files to delete

- `src/ui/Panel.tsx` — Tweakpane wrapper
- `src/ui/Panel.test.tsx` — its tests
- `src/engine/buildPaneFromManifest.ts` — imperative Tweakpane builder
- `src/engine/buildPaneFromManifest.test.ts` — its tests

### Files to modify

- `src/App.tsx` — full composition rewrite
- `src/main.tsx` — remove Tweakpane-adjacent comments; preserve modulationStore seed + initializePresetsIfEmpty + presetCycler.refresh + registerSW
- `src/ui/PresetCycler.ts` — drop `pane?: Pane` parameters; strip Tweakpane import; signatures become `cycleNext()`, `cyclePrev()`, `goTo(i)`, `refresh()`
- `src/ui/PresetStrip.tsx` — drop the `paneRef` prop + all `refreshPane` calls. The new primitives auto-sync via paramStore subscription.
- `src/index.css` or `src/App.css` (create if missing) — add `.app-layout` + `.app-body` classes
- `package.json` — remove deps
- `pnpm-lock.yaml` — regenerate

### Dependency cleanup

```bash
pnpm remove tweakpane @tweakpane/core @tweakpane/plugin-essentials
```

If `@tweakpane/core` is not in `package.json` (it's a peer of `@tweakpane/plugin-essentials` — confirmed in current `pnpm-lock.yaml`), omit from the remove command. Verify by inspecting package.json first; the task's L1 grep proves removal.

### Testids (all still mandatory)

Existing testids that must still appear in the DOM after the rewrite:
- `camera-state`, `stage`, `render-canvas`, `stage-video`, `webgl-canvas`, `overlay-canvas`
- `panel-root` (on Sidebar root), `params-panel` (on LayerCard1 body)
- `preset-bar`, `preset-name`, `preset-actions` (on PresetStrip)
- `record-button`, `record-elapsed` (on RecordButton inside Toolbar)
- `error-state-card-{PROMPT,USER_DENIED,SYSTEM_DENIED,DEVICE_CONFLICT,NOT_FOUND,MODEL_LOAD_FAIL,NO_WEBGL}`

Plus the new testids already added in prior DR-8 tasks:
- `toolbar`, `toolbar-wordmark`, `toolbar-cell-picker`
- `layer-card-grid`, `layer-card-mosaic`, `layer-card-input`
- `modulation-card`, `modulation-route-${n}`

### NOT Building

- No footer (DR-8.7)
- No new icon assets
- No mobile layout (blocked < 768px, DISCOVERY §8)
- No analytics

### Success Criteria

- [ ] `pnpm biome check src/ src/ui src/engine` exits 0
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] `grep -r 'tweakpane' src/` returns zero hits (OK if a commented historical note survives in a commit message, but not in source)
- [ ] `grep -rE "import .* from '.*tweakpane.*'" src/` returns zero hits
- [ ] `pnpm build` succeeds
- [ ] `src/ui/Panel.tsx`, `src/ui/Panel.test.tsx`, `src/engine/buildPaneFromManifest.ts`, `src/engine/buildPaneFromManifest.test.ts` all deleted
- [ ] `package.json` no longer lists `tweakpane`, `@tweakpane/core`, `@tweakpane/plugin-essentials`
- [ ] All 45 Phase 1–4 E2E specs still green
- [ ] New `task-DR-8-6.spec.ts` asserts the new chrome composition

---

## All Needed Context

```yaml
files:
  - path: src/App.tsx
    why: Composition to rewrite
    gotcha: Render-loop useEffect depends on `state, videoEl, textureGen` — keep exactly

  - path: src/main.tsx
    why: Store-seeding bootstrap — preserve order modulationStore → initializePresetsIfEmpty → presetCycler.refresh; drop Tweakpane paneRef notes

  - path: src/ui/Panel.tsx
    why: DELETE — Tweakpane wrapper; replaced by Sidebar + LayerCard1 + ModulationCard + PresetStrip

  - path: src/engine/buildPaneFromManifest.ts
    why: DELETE — imperative Tweakpane blade builder; no longer referenced

  - path: src/ui/PresetCycler.ts
    why: Modify — drop `pane?: Pane` parameters; remove `import type { Pane } from 'tweakpane'`

  - path: src/ui/PresetStrip.tsx
    why: Drop paneRef prop; simplify

  - path: src/ui/Stage.tsx
    why: Verify stage works inside a flex container; may need `.stage` rule tweak

  - path: src/ui/Stage.css
    why: May need `.stage` `position: relative` edit

  - path: src/ui/Toolbar.tsx
    why: Verify its getCanvas prop signature hasn't drifted

  - path: src/ui/Sidebar.tsx
    why: Verify slots render; type the `presetStripSlot` + `modulationSlot`

  - path: package.json
    why: Remove three deps

skills:
  - hand-tracker-fx-architecture
  - tweakpane-params-presets   # reference ONLY for retirement
  - prp-task-ralph-loop
  - playwright-e2e-webcam
  - vitest-unit-testing-patterns

discovery:
  - DR3: Replace Tweakpane entirely
  - DR8: Sidebar structure
```

### Current Codebase Tree (relevant)

```
src/
  App.tsx
  main.tsx
  ui/
    Panel.tsx                # DELETE
    Panel.test.tsx           # DELETE
    Stage.tsx
    Stage.css
    Toolbar.tsx
    Sidebar.tsx
    PresetStrip.tsx          # MODIFY
    PresetCycler.ts          # MODIFY
    ModulationCard.tsx
    RecordButton.tsx
  engine/
    buildPaneFromManifest.ts        # DELETE
    buildPaneFromManifest.test.ts   # DELETE
package.json
pnpm-lock.yaml
```

### Desired Codebase Tree

```
src/
  App.tsx                    # MODIFY — new composition
  App.module.css (or index.css edit) # create if needed for .app-layout/.app-body
  main.tsx                   # MODIFY — drop Tweakpane scaffolding comments
  ui/
    Sidebar.tsx              # ALREADY PRESENT — reuse slots
    (Panel.tsx deleted)
    (Panel.test.tsx deleted)
    PresetCycler.ts          # simplified
    PresetStrip.tsx          # simplified
  engine/
    (buildPaneFromManifest.ts deleted)
    (buildPaneFromManifest.test.ts deleted)
package.json                 # MODIFY
pnpm-lock.yaml               # MODIFY
tests/
  e2e/
    task-DR-8-6.spec.ts      # CREATE
```

### Known Gotchas

```typescript
// CRITICAL: The render-loop useEffect in App.tsx depends on `state, videoEl, textureGen`.
// `videoEl` is set via Stage's onVideoReady callback; `textureGen` is bumped on
// context restore. DO NOT change the effect's body logic — only the surrounding JSX
// composition. Preserve `stageRef`, `setVideoEl`, `handleTextureRecreated`.

// CRITICAL: Stage currently applies `position: fixed; inset: 0` via .stage CSS.
// In the new layout, the Stage lives inside a flex column next to the sidebar. If
// you keep `position: fixed`, the toolbar overlaps the top strip. Options:
//   (a) Make Stage relative — `.stage { position: relative; flex: 1 1 0; }` — and
//       wrap canvases in the existing absolute-inset-0 pattern (they already are).
//   (b) Leave Stage fixed, pad the top by toolbar height via a CSS variable.
// Prefer (a) for a clean flex layout. Update Stage.css.

// CRITICAL: Removing Tweakpane cleans up the paneRef path. In App.tsx, delete
//   import type { Pane } from 'tweakpane'
// and the `paneRef = useRef<Pane|null>(null)` line.

// CRITICAL: PresetCycler.ts still imports `import type { Pane } from 'tweakpane'` —
// delete the import + drop the optional arg.

// CRITICAL: PresetStrip.tsx also imports Pane; delete the import + the paneRef
// prop + refreshPane() helper.

// CRITICAL: Verify the param UI (sidebar) re-renders when a preset loads. When
// `loadPreset(name)` fires, it calls `paramStore.replace(next)` internally; every
// useParam subscriber re-reads via useSyncExternalStore's change notification.
// No pane.refresh() needed.

// CRITICAL: pnpm-lock.yaml must be regenerated after `pnpm remove`. Include the
// lockfile in the commit.

// CRITICAL: If the bundle analyzer is relevant, expect a significant size drop
// (~300 KB gzipped) from removing Tweakpane. No action required; informational.

// CRITICAL: The panel.spec.ts E2E (if it exists in tests/e2e) checks `panel-root`
// + `params-panel`. Both testids are preserved on Sidebar + LayerCard1 body —
// spec should still pass.

// CRITICAL: main.tsx's comment block above `presetCycler.refresh()` references
// Task 4.4 + the Tweakpane-import ordering race. Simplify the comment but keep the
// refresh() call — the ordering problem it solves (stale first-snapshot) remains.
```

---

## Implementation Blueprint

### Step 1: Remove Tweakpane deps

```bash
pnpm remove tweakpane @tweakpane/plugin-essentials
# Check if @tweakpane/core is a direct dep; if so:
# pnpm remove @tweakpane/core
```

Verify:
```bash
grep 'tweakpane' package.json
```

### Step 2: Delete `src/ui/Panel.tsx` + tests

```bash
git rm src/ui/Panel.tsx src/ui/Panel.test.tsx
```

### Step 3: Delete `src/engine/buildPaneFromManifest.ts` + tests

```bash
git rm src/engine/buildPaneFromManifest.ts src/engine/buildPaneFromManifest.test.ts
```

### Step 4: Simplify `src/ui/PresetCycler.ts`

- Drop `import type { Pane } from 'tweakpane'`
- Drop `pane?: Pane` arg from `cycleNext`, `cyclePrev`, `goTo`
- Remove `pane?.refresh()` calls

### Step 5: Simplify `src/ui/PresetStrip.tsx`

- Drop `paneRef` prop + `refreshPane()` helper
- Keydown handler still calls `presetCycler.cycleNext()` — arg-free now

### Step 6: Rewrite `src/App.tsx`

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCamera } from './camera/useCamera';
import { handTrackingMosaicManifest } from './effects/handTrackingMosaic';
import type { EffectInstance } from './engine/manifest';
import { applyModulation, resolveModulationSources } from './engine/modulation';
import { modulationStore } from './engine/modulationStore';
import { paramStore } from './engine/paramStore';
import { reducedMotion } from './engine/reducedMotion';
import { uploadVideoFrame } from './engine/renderer';
import { startRenderLoop } from './engine/renderLoop';
import { initHandLandmarker } from './tracking/handLandmarker';
import { ErrorStates } from './ui/ErrorStates';
import { ModulationCard } from './ui/ModulationCard';
import { PrePromptCard } from './ui/PrePromptCard';
import { PresetStrip } from './ui/PresetStrip';
import { Sidebar } from './ui/Sidebar';
import { Stage, type StageHandle } from './ui/Stage';
import { Toolbar } from './ui/Toolbar';

export function App() {
  const { state, retry, stream } = useCamera();
  const [trackerError, setTrackerError] = useState<unknown>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [textureGen, setTextureGen] = useState(0);
  const handleTextureRecreated = useCallback(() => setTextureGen((g) => g + 1), []);
  const stageRef = useRef<StageHandle | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: textureGen is a re-run signal
  useEffect(() => {
    if (state !== 'GRANTED' || !videoEl) return;
    let cancelled = false;
    let stopLoop: (() => void) | null = null;
    let effectInstance: EffectInstance | null = null;
    (async () => {
      try {
        const landmarker = await initHandLandmarker();
        if (cancelled) return;
        const overlayCanvas = stageRef.current?.overlayCanvas ?? null;
        const overlayCtx2d = overlayCanvas ? overlayCanvas.getContext('2d') : null;
        const webglCanvas = stageRef.current?.webglCanvas ?? null;
        const gl = webglCanvas?.getContext('webgl2') ?? null;
        if (gl) {
          effectInstance = handTrackingMosaicManifest.create(gl);
        }
        const handle = startRenderLoop({
          video: videoEl,
          landmarker,
          overlayCtx2d,
          onFrame: (ctx) => {
            const tex = stageRef.current?.getVideoTexture() ?? null;
            if (tex && videoEl) uploadVideoFrame(tex, videoEl);
            if (!reducedMotion.getIsReduced()) {
              const sources = resolveModulationSources(ctx.landmarks);
              const routes = modulationStore.getSnapshot().routes;
              const next = applyModulation(routes, sources, paramStore.snapshot);
              if (next !== paramStore.snapshot) paramStore.replace(next);
            }
            const frame = tex ? { ...ctx, videoTexture: tex.texture } : ctx;
            effectInstance?.render(frame);
          },
          onError: (err) => console.error('[App] detectForVideo error', err),
        });
        stopLoop = handle.stop;
      } catch (err) {
        if (!cancelled) setTrackerError(err);
        console.error('[App] initHandLandmarker failed', err);
      }
    })();
    return () => {
      cancelled = true;
      if (stopLoop) stopLoop();
      if (effectInstance) { effectInstance.dispose(); effectInstance = null; }
    };
  }, [state, videoEl, textureGen]);

  return (
    <main className="app-shell">
      <p data-testid="camera-state" style={{ position: 'absolute', left: -9999 }}>{state}</p>
      {state === 'PROMPT' && <PrePromptCard onAllow={retry} />}
      {state !== 'PROMPT' && state !== 'GRANTED' && <ErrorStates state={state} onRetry={retry} />}
      {state === 'GRANTED' && (
        <div className="app-layout">
          <Toolbar getCanvas={() => stageRef.current?.overlayCanvas ?? null} />
          <div className="app-body">
            <Stage
              ref={stageRef}
              stream={stream}
              mirror
              onVideoReady={(el) => setVideoEl(el)}
              onTextureRecreated={handleTextureRecreated}
            />
            <Sidebar
              presetStripSlot={<PresetStrip />}
              modulationSlot={<ModulationCard />}
            />
          </div>
          {trackerError ? <p data-testid="tracker-error" hidden>tracker error</p> : null}
        </div>
      )}
    </main>
  );
}
```

### Step 7: CSS — new `.app-layout` + `.app-body` classes

Add to `src/index.css` (or a new `src/App.module.css`):

```css
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
}
.app-body {
  display: flex;
  flex-direction: row;
  flex: 1 1 0;
  min-height: 0;
}
.app-body .stage {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
}
```

(Only the `.stage` override is required if Stage.css stays with its own `.stage` rule; use cascade carefully or edit Stage.css directly — cleanly done in Stage.css.)

### Step 8: Stage.css tweak

Change the `.stage` rule:

```css
.stage { position: relative; width: 100%; height: 100%; background: #000; overflow: hidden; }
```

(Drop `position: fixed; inset: 0;`.)

### Step 9: main.tsx comment cleanup

Simplify comments; keep functional calls:

```tsx
modulationStore.replaceRoutes(DEFAULT_MODULATION_ROUTES);
initializePresetsIfEmpty();
presetCycler.refresh();
```

Remove the paragraph-long Tweakpane / PresetCycler ordering prose — replace with a single line:

```tsx
// DR-8.6 retirement: Tweakpane removed; paneRef wiring no longer needed.
```

### Step 10: E2E spec

```typescript
import { test, expect } from '@playwright/test';

test.describe('Task DR-8.6: new chrome composition', () => {
  test('no tweakpane elements in DOM', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="camera-state"]')?.textContent === 'GRANTED',
    );
    expect(await page.locator('.tp-dfwv, .tp-rotv').count()).toBe(0);
  });

  test('all mandatory testids present', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="camera-state"]')?.textContent === 'GRANTED',
    );
    for (const id of [
      'stage', 'render-canvas', 'stage-video', 'webgl-canvas', 'overlay-canvas',
      'panel-root', 'params-panel',
      'preset-bar', 'preset-name', 'preset-actions',
      'record-button', 'record-elapsed',
      'toolbar', 'toolbar-wordmark', 'toolbar-cell-picker',
      'layer-card-grid', 'layer-card-mosaic', 'layer-card-input',
      'modulation-card',
    ]) {
      await expect(page.getByTestId(id)).toBeVisible({ timeout: 10_000 });
    }
  });

  test('params edit + preset save still works', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="camera-state"]')?.textContent === 'GRANTED',
    );
    await page.getByTestId('toolbar-cell-picker').getByText('XL', { exact: true }).click();
    page.on('dialog', async (d) => { if (d.type() === 'prompt') await d.accept('WireTest'); });
    await page.getByTestId('preset-actions').getByText('Save As').click();
    const name = await page.getByTestId('preset-name').inputValue();
    expect(name).toBe('WireTest');
  });
});
```

---

## Validation Loop

### Level 1

```bash
pnpm biome check .
pnpm tsc --noEmit
grep -r 'tweakpane' src/ || echo "OK: no tweakpane in src/"
grep -rE "import .* from '.*tweakpane.*'" src/ || echo "OK: no tweakpane imports"
# Ensure package.json no longer lists them:
grep -E '"(tweakpane|@tweakpane/core|@tweakpane/plugin-essentials)"' package.json || echo "OK: deps removed"
# Deletions:
test ! -f src/ui/Panel.tsx
test ! -f src/ui/Panel.test.tsx
test ! -f src/engine/buildPaneFromManifest.ts
test ! -f src/engine/buildPaneFromManifest.test.ts
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
pnpm test:e2e --grep "Task DR-8.6:"
pnpm test:e2e
# Stage.css changed from position: fixed to position: relative; flex: 1 1 0. Re-run the phase-3 regression
# (or stage-visual if it exists) to confirm the mosaic still captures at the same aspect ratio and viewport size.
pnpm test:e2e tests/e2e/phase-3-regression.spec.ts
```

All 45 phase-1..4 specs must pass. The phase-3 regression run is an explicit verification step: any aspect-ratio drift in the mosaic indicates the ResizeObserver + WebGL viewport calc is mismeasuring. If regressions appear, revert the Stage.css change and wrap Stage in a flex-parent instead.

---

## Final Validation Checklist

### Technical
- [ ] `grep -r 'tweakpane' src/` empty
- [ ] package.json and pnpm-lock.yaml clean of tweakpane deps
- [ ] Four deleted files confirmed gone
- [ ] All 4 validation levels exit 0
- [ ] 45 existing E2E specs still pass

### Feature
- [ ] App renders with Toolbar + Stage + Sidebar composition
- [ ] Sidebar contains PresetStrip + LayerCard1 + ModulationCard (all visible)
- [ ] Params editable via sidebar; toolbar cell-picker drives tileSize
- [ ] Preset save/load/delete/export/import works
- [ ] ArrowLeft/Right cycles preset
- [ ] Record button in toolbar records + downloads webm

### Code Quality
- [ ] No Pane or Tweakpane import anywhere in src/
- [ ] PresetCycler signature cleaned (no Pane args)
- [ ] No inline hex / px values introduced

---

## Anti-Patterns

- Do not change paramStore or modulationStore; this task is pure chrome wiring.
- Do not remove `presetCycler.refresh()` from main.tsx — the ordering fix is still valid.
- Do not ship with Panel.tsx commented out — delete it.
- Do not add `tweakpane` back as a dev dep; it's gone.
- Do not skip the `grep 'tweakpane'` check — it's the litmus test.

---

## No Prior Knowledge Test

- [ ] Four deletions enumerated
- [ ] `pnpm remove` exact command listed
- [ ] grep-based verification commands listed
- [ ] Every testid still expected is enumerated
- [ ] New CSS class names listed (`.app-layout`, `.app-body`)

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/tweakpane-params-presets/SKILL.md  # reference-only (retirement)
.claude/skills/playwright-e2e-webcam/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
```
