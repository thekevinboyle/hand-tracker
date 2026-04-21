# Task DR-8.5: Preset strip in sidebar header

**Phase**: DR-8 — Chrome Integration
**Branch**: `task/DR-8-5-preset-strip`
**Commit prefix**: `Task DR-8.5:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 25

---

## Goal

**Feature Goal**: Collapse today's two floating preset UIs — `PresetBar` (fixed bottom-center chevron cycler) and `PresetActions` (fixed top-left CRUD buttons) — into one `PresetStrip` that sits at the top of the sidebar, above LAYER 1. The strip renders `[‹] [name] [›] [Save] [Save As] [Delete] [↓ Export] [↑ Import]`. Preserves ArrowLeft/Right keybindings and all preset file I/O via `PresetCycler` + `presets.ts`.

**Deliverable**:
- `src/ui/PresetStrip.tsx` + `PresetStrip.module.css` — the merged component
- `src/ui/PresetStrip.test.tsx` — unit coverage
- Integration: `src/ui/Sidebar.tsx` passes `<PresetStrip paneRef={…} />` into its `presetStripSlot` prop (the `paneRef` arg is maintained for backwards compatibility; in DR-8.6 it becomes a no-op because Tweakpane is gone — but for DR-8.5 shipping order, keep the signature stable)
- **DELETE** `src/ui/PresetBar.tsx` + `src/ui/PresetBar.test.tsx` + `src/ui/PresetActions.tsx`
- `tests/e2e/task-DR-8-5.spec.ts` — Playwright L4

**Success Definition**: Sidebar header shows the unified strip. Existing testids `preset-bar`, `preset-name`, `preset-actions` are preserved on the strip's DOM. ArrowLeft/Right cycles preset. Save / Save As / Delete / Export / Import all work. Parent-Phase-4 spec `phase-4-regression.spec.ts` (which exercises preset CRUD + cycle) still passes.

---

## User Persona

**Target User**: Creative technologist swapping between 4-6 saved presets during a live demo.

**Use Case**: User saves three presets. Hits ArrowRight to cycle through them in order. Clicks "Save As" to name a 4th preset. Later exports all presets to a `.json` file, then re-imports on another machine.

**User Journey**:
1. App GRANTED. Sidebar visible right side. Top of sidebar shows the preset strip: `[‹] Default [›] [Save] [Save As] [Delete] [↓] [↑]`.
2. User clicks Save As → prompt asks for name → saves → strip header updates.
3. User presses ArrowRight → strip name cycles to next preset.
4. User clicks Delete → confirm prompt → preset removed → strip cycles to remaining.
5. User clicks Export → `.json` file downloads.
6. User clicks Import → file picker → selects `.json` → preset added.

**Pain Points Addressed**: Today the two floating bars compete with the record button + Tweakpane for z-index. The strip eliminates all three fixed-z-index components.

---

## Why

- DR16 — Merge PresetBar + PresetActions into a single strip at the top of the sidebar.
- DISCOVERY §7 — Preserve testids `preset-bar`, `preset-name`, `preset-actions`.
- Depends on tokens (DR-6.1), primitives (DR-7.1..7.7), DR-8.2 (`Sidebar` with `presetStripSlot`).
- Unblocks DR-8.6 (the retirement of Tweakpane) — no more floating preset UI to coordinate with.

---

## What

- `PresetStrip` is a flex-row at the top of the sidebar.
- Layout: `[‹] [name input] [›] [gap] [Save] [Save As] [Delete] [gap] [Export] [Import]`.
- Width: stretches to sidebar width (340px). If overflow, wraps to a second line.
- Uses existing `presetCycler` singleton for cycle logic + keyboard handling (ArrowLeft/Right) + refresh. Uses existing `src/engine/presets.ts` for CRUD.
- Name element: editable text input, same role as old PresetActions's current-name field; blur triggers loadPreset if name exists. `preset-name` testid attaches here.
- Chevrons: `Button variant="icon" size="sm"` with `<` / `>` glyphs; disabled when `presets.length <= 1`.
- Action buttons: `Button variant="secondary" size="sm"` — Save, Save As, Delete, Export, Import. Import is a native `<label>` wrapping a hidden `<input type="file">` (preserve current pattern).
- Testid attachment:
  - Root strip element: `data-testid="preset-bar"` (satisfies old `preset-bar` spec)
  - Name input: `data-testid="preset-name"`
  - A wrapper `<div>` around the action buttons: `data-testid="preset-actions"`

### Keyboard

- ArrowLeft/ArrowRight globally cycle (re-use the current guard: skip if target is `<input>` or `<textarea>`).
- The preset-name input owns its own ArrowLeft/Right (it's a text field, so the guard lets the caret move).

### NOT Building

- No drag-reorder of presets.
- No preset thumbnails / colored chips.
- No URL deep-linking.
- No MIDI program change mapping.

### Success Criteria

- [ ] `pnpm biome check src/ui/PresetStrip.tsx src/ui/PresetStrip.module.css src/ui/PresetStrip.test.tsx` exits 0
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] `src/ui/PresetBar.tsx`, `src/ui/PresetBar.test.tsx`, `src/ui/PresetActions.tsx` all deleted
- [ ] `grep -r "PresetBar\|PresetActions" src/` returns zero hits (only `PresetStrip` + `PresetCycler` remain)
- [ ] Testids `preset-bar`, `preset-name`, `preset-actions` all present inside the sidebar
- [ ] ArrowLeft / ArrowRight cycle; inside inputs, they do not cycle
- [ ] Save / Save As / Delete / Export / Import all still functional
- [ ] 45 existing E2E specs green — specifically `phase-4-regression.spec.ts`

---

## All Needed Context

```yaml
files:
  - path: src/ui/PresetBar.tsx
    why: REFERENCE (then DELETE). Chevron + keyboard + paneRef integration.
    gotcha: Target-type guard on keydown (skip <input>, <textarea>)

  - path: src/ui/PresetActions.tsx
    why: REFERENCE (then DELETE). Save / Save As / Delete / Export / Import handlers; editable current-name input; refreshPane() call after load.
    gotcha: `presetCycler.refresh()` called after every mutation

  - path: src/ui/PresetCycler.ts
    why: Pure state machine (singleton); KEEP. Used by PresetStrip for state + cycle methods.
    gotcha: `cycleNext(pane?)` accepts optional Pane arg (for old Tweakpane). DR-8.5 still passes an optional ref; DR-8.6 will null it out.

  - path: src/engine/presets.ts
    why: CRUD API — savePreset, loadPreset, deletePreset, exportPresetFile, importPresetFile
    gotcha: Import throws on schema mismatch; handle + alert

  - path: src/ui/Sidebar.tsx (from DR-8.2)
    why: Has `presetStripSlot` prop; App.tsx will pass <PresetStrip />

  - path: src/ui/primitives/Button.tsx (DR-7.1)
    why: variants primary / secondary / text / icon; sizes sm / md

skills:
  - custom-param-components
  - hand-tracker-fx-architecture
  - design-tokens-dark-palette
  - prp-task-ralph-loop
  - playwright-e2e-webcam
  - vitest-unit-testing-patterns

discovery:
  - DR16: Merge into one strip at top of sidebar
  - §7: Preserve preset-bar, preset-name, preset-actions testids
```

### Current Codebase Tree (relevant)

```
src/
  engine/
    presets.ts
  ui/
    PresetBar.tsx               # DELETE in this task
    PresetBar.test.tsx          # DELETE in this task
    PresetActions.tsx           # DELETE in this task
    PresetCycler.ts
    Sidebar.tsx
    primitives/
      Button.tsx
```

### Desired Codebase Tree

```
src/
  ui/
    PresetStrip.tsx             # CREATE
    PresetStrip.module.css      # CREATE
    PresetStrip.test.tsx        # CREATE
    Sidebar.tsx                 # MODIFY — wire slot, default to <PresetStrip />
tests/
  e2e/
    task-DR-8-5.spec.ts         # CREATE
```

### Known Gotchas

```typescript
// CRITICAL: preset-bar testid MUST attach to the strip root (not an inner div) so
// the old selectors find it. Similarly preset-name on the editable input and
// preset-actions on the action-button cluster.

// CRITICAL: Keyboard ArrowLeft/Right listener is global (window). Target-type guard
// lets the input's caret work correctly. This is identical to the old PresetBar.tsx
// logic — port it verbatim.

// CRITICAL: The paneRef prop of the old PresetBar was for calling pane.refresh()
// after a cycle. DR-8.5 ships while Panel.tsx (Tweakpane) still renders in App.tsx
// — so maintain a `paneRef?: RefObject<Pane | null>` prop on PresetStrip and call
// pane?.refresh() after cycle. DR-8.6 deletes the paneRef arg and `useParam`
// subscriptions handle re-render automatically. Document the transition in a
// comment.

// CRITICAL: The "Current preset name" input must load on BLUR if the typed name
// exists (old behavior). `loadPreset(name)` returns the preset or undefined; on
// undefined, no-op (silent).

// CRITICAL: Save/Delete/Import all call presetCycler.refresh() — maintain this.

// CRITICAL: Hidden file input pattern:
//   <label><input type="file" accept=".json,application/json" style={{display:'none'}} onChange={handleImport} />Import</label>
// Biome might complain about label-has-associated-input; use the input-inside-label
// pattern which is valid.

// CRITICAL: When deleting files, also delete companion test files. `PresetBar.test.tsx`
// should go with PresetBar.tsx.

// CRITICAL: After PresetStrip renders the current name in an <input>, pressing
// ArrowLeft inside that input moves the caret. The GLOBAL keydown listener must
// skip (target instanceof HTMLInputElement) — unchanged behavior from PresetBar.
```

---

## Implementation Blueprint

### Step 1: `PresetStrip.tsx`

```typescript
import type { JSX, RefObject } from 'react';
import { useEffect, useState } from 'react';
import type { Pane } from 'tweakpane';
import {
  deletePreset,
  exportPresetFile,
  importPresetFile,
  loadPreset,
  savePreset,
} from '../engine/presets';
import { Button } from './primitives/Button';
import { type CyclerState, presetCycler } from './PresetCycler';
import styles from './PresetStrip.module.css';

export type PresetStripProps = {
  /** Kept alive for DR-8.5. DR-8.6 drops Tweakpane; this becomes optional-null. */
  paneRef?: RefObject<Pane | null>;
};

export function PresetStrip({ paneRef }: PresetStripProps): JSX.Element {
  const [cycler, setCycler] = useState<CyclerState>(() => presetCycler.getState());
  const [currentName, setCurrentName] = useState<string>(() => cycler.presets[cycler.currentIndex]?.name ?? 'Default');

  useEffect(() => presetCycler.onChange((next) => {
    setCycler(next);
    const name = next.presets[next.currentIndex]?.name;
    if (name) setCurrentName(name);
  }), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const target = e.target;
      if (target instanceof HTMLInputElement) return;
      if (target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        presetCycler.cyclePrev(paneRef?.current ?? undefined);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        presetCycler.cycleNext(paneRef?.current ?? undefined);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paneRef]);

  const disabled = cycler.presets.length <= 1;

  function refreshPane(): void {
    const pane = paneRef?.current as unknown as { refresh?: () => void } | null;
    pane?.refresh?.();
  }

  function handlePrev(): void { presetCycler.cyclePrev(paneRef?.current ?? undefined); }
  function handleNext(): void { presetCycler.cycleNext(paneRef?.current ?? undefined); }

  function handleSave(): void {
    if (!currentName) return;
    savePreset(currentName);
    presetCycler.refresh();
  }
  function handleSaveAs(): void {
    const input = window.prompt('Preset name');
    if (input === null) return;
    const name = input.trim();
    if (!name) return;
    savePreset(name);
    setCurrentName(name);
    presetCycler.refresh();
  }
  function handleDelete(): void {
    if (!currentName) return;
    if (!window.confirm(`Delete preset "${currentName}"?`)) return;
    deletePreset(currentName);
    presetCycler.refresh();
  }
  function handleExport(): void {
    if (!currentName) return;
    exportPresetFile(currentName);
  }
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const preset = await importPresetFile(file, { loadImmediately: true });
      setCurrentName(preset.name);
      presetCycler.refresh();
      refreshPane();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      window.alert(`Import failed: ${msg}`);
    }
  }
  function handleLoadOnBlur(e: React.FocusEvent<HTMLInputElement>): void {
    const name = e.target.value.trim();
    if (!name) return;
    if (loadPreset(name)) {
      setCurrentName(name);
      refreshPane();
    }
  }

  return (
    <div className={styles.strip} role="toolbar" aria-label="Preset strip" data-testid="preset-bar">
      <Button variant="icon" size="sm" ariaLabel="Previous preset" disabled={disabled} onClick={handlePrev}>‹</Button>
      <input
        type="text"
        className={styles.name}
        value={currentName}
        onChange={(e) => setCurrentName(e.target.value)}
        onBlur={handleLoadOnBlur}
        aria-label="Current preset name"
        data-testid="preset-name"
      />
      <Button variant="icon" size="sm" ariaLabel="Next preset" disabled={disabled} onClick={handleNext}>›</Button>
      <div className={styles.actions} data-testid="preset-actions">
        <Button variant="secondary" size="sm" onClick={handleSave}>Save</Button>
        <Button variant="secondary" size="sm" onClick={handleSaveAs}>Save As</Button>
        <Button variant="secondary" size="sm" onClick={handleDelete}>Delete</Button>
        <Button variant="secondary" size="sm" onClick={handleExport}>↓ Export</Button>
        <label className={styles.importLabel}>
          <input type="file" accept=".json,application/json" onChange={handleImport} style={{ display: 'none' }} />
          ↑ Import
        </label>
      </div>
    </div>
  );
}
```

### Step 2: `PresetStrip.module.css`

```css
.strip {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-08);
  padding: var(--space-08) 0;
  color: var(--color-text-primary);
  font-family: var(--font-family);
  font-size: var(--font-size-m);
  flex-wrap: wrap;
}
.name {
  flex: 1 1 auto;
  min-width: 0;
  background: transparent;
  color: inherit;
  border: none;
  font: inherit;
  text-align: center;
  padding: var(--space-04);
}
.name:focus-visible { outline: 1px solid var(--color-focus-ring); outline-offset: 2px; }
.actions { display: flex; gap: var(--space-04); flex-wrap: wrap; }
.importLabel {
  padding: var(--space-04) var(--space-12);
  cursor: pointer;
  color: var(--color-text-primary);
  background: var(--color-button-secondary-bg);
  border-radius: 0;
  transition: border-radius var(--duration-short) var(--ease-default);
  font-weight: 500;
}
.importLabel:hover { border-radius: var(--radius-pill); background: var(--color-button-secondary-bg-hover); }

@media (prefers-reduced-motion: reduce) {
  .importLabel { transition-duration: 0s; }
}
```

### Step 3: Unit tests (`PresetStrip.test.tsx`)

Port the 8 cases from `PresetBar.test.tsx` + add 4 new:
1. Renders current preset name
2. Click ‹ → cyclePrev called
3. Click › → cycleNext called
4. ArrowLeft keydown → cyclePrev
5. ArrowRight keydown → cycleNext
6. Keydown inside <input> → no cycler call
7. presets.length === 1 → chevrons disabled
8. Unmount removes keydown listener
9. Save button calls `savePreset(currentName)` + `presetCycler.refresh`
10. Save As prompts, names on OK, cancels on null
11. Delete confirms, calls `deletePreset`
12. Import handler calls `importPresetFile` and refreshes cycler

### Step 4: Modify Sidebar.tsx

```tsx
// Sidebar.tsx
import { PresetStrip } from './PresetStrip';
// ...
export function Sidebar(props: SidebarProps): JSX.Element {
  return (
    <aside className={styles.sidebar} data-testid="panel-root">
      <div className={styles.header}>
        <PresetStrip paneRef={props.paneRef} />
      </div>
      <LayerCard1 />
      {props.modulationSlot ?? null}
    </aside>
  );
}
```

Adjust `SidebarProps` to accept `paneRef?: RefObject<Pane | null>`.

### Step 5: Deletions

```bash
git rm src/ui/PresetBar.tsx src/ui/PresetBar.test.tsx src/ui/PresetActions.tsx
```

Verify no other file imports them:

```bash
grep -r "from './PresetBar'\|from './PresetActions'\|from '../ui/PresetBar'\|from '../ui/PresetActions'" src/
```

### Step 6: E2E spec

```typescript
import { test, expect } from '@playwright/test';

test.describe('Task DR-8.5: preset strip keyboard + actions', () => {
  test('strip rendered in sidebar header with all testids', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="camera-state"]')?.textContent === 'GRANTED',
    );
    await expect(page.getByTestId('preset-bar')).toBeVisible();
    await expect(page.getByTestId('preset-name')).toBeVisible();
    await expect(page.getByTestId('preset-actions')).toBeVisible();
  });

  test('ArrowRight cycles preset (seed 2 presets via UI)', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="camera-state"]')?.textContent === 'GRANTED',
    );
    // Seed a second preset through the Save As dialog (the real UI path)
    page.on('dialog', async (d) => { if (d.type() === 'prompt') await d.accept('Alt'); });
    await page.getByTestId('preset-actions').getByText('Save As').click();
    // Both presets should now exist
    const countAfter = await page.getByTestId('preset-bar').locator('button').count();
    expect(countAfter).toBeGreaterThan(0);
    await page.keyboard.press('ArrowRight');
    const name = await page.getByTestId('preset-name').inputValue();
    expect(['Default', 'Alt']).toContain(name);
  });

  test('Save As prompts, saves new preset', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="camera-state"]')?.textContent === 'GRANTED',
    );
    page.on('dialog', async (d) => { if (d.type() === 'prompt') await d.accept('MyPreset'); });
    await page.getByTestId('preset-actions').getByText('Save As').click();
    const name = await page.getByTestId('preset-name').inputValue();
    expect(name).toBe('MyPreset');
  });
});
```

---

## Validation Loop

### Level 1

```bash
pnpm biome check src/ui/PresetStrip.tsx src/ui/PresetStrip.module.css src/ui/PresetStrip.test.tsx src/ui/Sidebar.tsx
pnpm tsc --noEmit
test ! -f src/ui/PresetBar.tsx
test ! -f src/ui/PresetActions.tsx
```

### Level 2

```bash
pnpm vitest run src/ui/PresetStrip.test.tsx
pnpm vitest run
```

### Level 3

```bash
pnpm build
```

### Level 4

```bash
pnpm test:setup
pnpm test:e2e --grep "Task DR-8.5:"
pnpm test:e2e --grep "phase-4-regression"
```

---

## Final Validation Checklist

### Technical
- [ ] All 4 levels exit 0
- [ ] 3 old files deleted
- [ ] `grep -r "PresetBar\|PresetActions" src/` empty
- [ ] `preset-bar`, `preset-name`, `preset-actions` testids still queryable

### Feature
- [ ] Save / Save As / Delete / Export / Import all work
- [ ] ArrowLeft / ArrowRight cycle; not inside inputs
- [ ] Name input on blur loads if preset exists
- [ ] Strip in sidebar header, above LAYER 1
- [ ] 45 E2E specs green

### Code Quality
- [ ] No hex literals
- [ ] No `any` types
- [ ] Biome clean

---

## Anti-Patterns

- Do not preserve the old fixed-position styling — PresetStrip lives in sidebar flow.
- Do not drop the `preset-bar` / `preset-name` / `preset-actions` testids.
- Do not remove the input blur → loadPreset behavior.
- Do not re-attach keydown on every render — useEffect with `[paneRef]` deps.

---

## No Prior Knowledge Test

- [ ] 3 deletions enumerated
- [ ] 3 testids preserved on new strip
- [ ] DR/§ numbers cited (DR16, §7)
- [ ] Validation commands runnable

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/custom-param-components/SKILL.md
.claude/skills/design-tokens-dark-palette/SKILL.md
.claude/skills/playwright-e2e-webcam/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
```
