# Task DR-8.4: Restyled error + pre-prompt cards

**Phase**: DR-8 — Chrome Integration
**Branch**: `task/DR-8-4-error-cards-restyle`
**Commit prefix**: `Task DR-8.4:`
**Estimated complexity**: Small
**Max Ralph iterations**: 15

---

## Goal

**Feature Goal**: Restyle the 8 camera-permission-state cards (`PrePromptCard` + `ErrorStates`) with the new tokens-driven palette and JetBrains Mono font. Keep every testid, copy string, `role`, `aria-live`, and retry-button behavior unchanged so the existing error-state E2E specs keep passing. Add a hairline `<hr>` divider between title and body (DR14).

**Deliverable**:
- `src/ui/cards.css` — rewritten with token variables + new color palette (panel bg `#151515` → `var(--color-panel)`, hairline divider `var(--color-divider)`)
- Optional: `src/ui/PrePromptCard.tsx` + `src/ui/ErrorStates.tsx` — insert a divider `<hr>` element between title and body
- `tests/e2e/task-DR-8-4.spec.ts` — Playwright L4 spec asserting all 8 card states render under the new styling

**Success Definition**: All 8 `error-state-card-{state}` testids still render correctly. Computed background of card is `var(--color-panel)` (`#151515`). Divider visible between title and body. All existing `errorStates.spec.ts` specs pass. Font-family resolves to JetBrains Mono.

---

## User Persona

**Target User**: First-time visitor or revisiting user whose camera permission was revoked — sees a clean dark card explaining what's wrong and how to fix it.

**Use Case**: User loads the app; camera prompt appears. User dismisses it (`USER_DENIED`). The error card appears — dark `#151515` panel, JetBrains Mono text, hairline rule between title and body, "Try Again" button. User clicks the button → browser re-prompts.

**User Journey**:
1. Page loads. Camera state begins as `PROMPT` → `PrePromptCard` renders with copy "Enable your camera".
2. Visual: centered card, 480px max-width, panel bg `#151515`, text `#EAEAEA`, subtle hairline between title and body.
3. User clicks "Enable Camera".
4. Permission denied → `USER_DENIED` state → `ErrorStates` renders with the same visual skeleton, "Camera access blocked" title, "Try Again" button.
5. User clicks Try Again → browser re-prompts.

**Pain Points Addressed**: Current cards are a one-off palette of `#1c1c1e` + hardcoded `#fafafb` text with no visual relationship to the reworked chrome.

---

## Why

- DR14 — Restyle, keep structure. Existing role/aria-live/testids preserved.
- DR5 — Dark palette: panel `#151515`, text `#EAEAEA`, hairline `#1F1F1F`.
- DR7 — JetBrains Mono everywhere.
- Depends on DR-6.1 (tokens), DR-6.2 (font). Parallelizable with DR-8.1..3.
- Unblocks DR-8.R regression (error-card visuals need to match).

---

## What

- Every color in `cards.css` → `var(--color-*)`
- Every pixel value → `var(--space-*)` or `rem`-based calc
- Font family inherits from body (`var(--font-family)` baseline set in DR-6.2)
- New `<hr class="card-divider" />` inserted between `.card-title` and `.card-body` in both `PrePromptCard.tsx` and `ErrorStates.tsx`
- `.card-retry` button restyled to match the `Button` primitive's primary visual (but `cards.css` is still bespoke — no React primitive swap here because the cards are rendered PRE-GRANTED, before the sidebar/toolbar chrome is mounted; keep them standalone CSS to avoid importing React primitives inside the error surface).

### Current computed styles (pre-rework) — from `src/ui/cards.css`

- `.card` fixed inset 0, flex-center, bg (none; parent shows through)
- `.card-title` `1.5rem`, color `#fafafb`
- `.card-body` `1rem`, color `#c7c7cc`
- `.card-retry` bg `#1c1c1e`, border `#3a3a3c`, hover `#2c2c2e`, focus `#6aa9ff`

### Target computed styles (post-rework)

- `.card` fixed inset 0, flex-center, bg `var(--color-bg)` (so the card-panel reads as `#151515` over page `#0A0A0B`)
- Card panel container (new element or existing `.card`): width up to 480px, padding `var(--space-32)`, bg `var(--color-panel)` (#151515), no border
- `.card-title` `var(--font-size-l)` ~16.5px (fluid), font-weight 600, color `var(--color-text-primary)`
- `.card-divider` `border: 0; border-top: 1px solid var(--color-divider); margin: var(--space-16) 0`
- `.card-body` `var(--font-size-m)`, color `var(--color-text-muted)`
- `.card-retry` bg `var(--color-button-secondary-bg)`, color `var(--color-text-primary)`, padding `var(--space-12) var(--space-24)`, border-radius 0 → `var(--radius-pill)` on hover (per DR11), focus-ring `var(--color-focus-ring)`

### Testids (all preserved)

- `error-state-card-PROMPT`
- `error-state-card-USER_DENIED`
- `error-state-card-SYSTEM_DENIED`
- `error-state-card-DEVICE_CONFLICT`
- `error-state-card-NOT_FOUND`
- `error-state-card-MODEL_LOAD_FAIL`
- `error-state-card-NO_WEBGL`
- (No GRANTED card — shown only in states where the UI is not the stage)

### NOT Building

- No new copy strings (DR14 preserves copy).
- No retry animation changes beyond the square→pill hover (which is already DR11).
- No A11y changes beyond inheriting the focus-ring token.
- No React component swap for `.card-retry` → Button primitive (those primitives depend on the full page state; keep cards.css self-contained).

### Success Criteria

- [ ] `pnpm biome check src/ui/cards.css src/ui/PrePromptCard.tsx src/ui/ErrorStates.tsx` exits 0
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] `grep -E '#[0-9a-fA-F]{3,6}' src/ui/cards.css` returns zero hits
- [ ] All 8 testids render with the new panel bg (computed `background-color` matches `#151515` — i.e. `var(--color-panel)`)
- [ ] Existing `errorStates.spec.ts` spec passes
- [ ] New `task-DR-8-4.spec.ts` iterates all 8 states and asserts divider visibility + testid
- [ ] Reduced-motion branch in `cards.css` updated to keep hover pill collapse to duration 0

---

## All Needed Context

```yaml
files:
  - path: src/ui/cards.css
    why: The file being rewritten. Keep selectors (.card, .card-title, .card-body, .card-retry) so the .tsx files don't change class names.

  - path: src/ui/PrePromptCard.tsx
    why: Structural addition of <hr class="card-divider" /> between title and body. Preserve testid + role + aria-live + onClick.

  - path: src/ui/ErrorStates.tsx
    why: Same structural change; maps CameraState → card copy via errorCopy.ts.

  - path: src/ui/errorCopy.ts
    why: Copy strings — DO NOT modify.

  - path: src/ui/tokens.css
    why: Tokens to reference (--color-bg, --color-panel, --color-divider, --color-text-primary, --color-text-muted, --color-button-secondary-bg, --color-focus-ring, --font-family, --space-* tokens, --radius-pill, --duration-fast, --ease-default)

  - path: tests/e2e/errorStates.spec.ts
    why: Existing spec — DR-8.4 must not break it

skills:
  - webcam-permissions-state-machine
  - design-tokens-dark-palette
  - prp-task-ralph-loop
  - playwright-e2e-webcam
  - vitest-unit-testing-patterns

discovery:
  - DR5: Dark palette values
  - DR7: JetBrains Mono
  - DR11: Square→pill hover animation
  - DR14: Restyle cards; keep structure; divider between title and body
```

### Current Codebase Tree (relevant)

```
src/
  ui/
    cards.css
    PrePromptCard.tsx
    ErrorStates.tsx
    errorCopy.ts
    tokens.css
tests/
  e2e/
    errorStates.spec.ts
```

### Desired Codebase Tree

```
src/
  ui/
    cards.css            # MODIFY — tokens only, no hex
    PrePromptCard.tsx    # MODIFY — insert <hr class="card-divider" />
    ErrorStates.tsx      # MODIFY — insert <hr class="card-divider" />
tests/
  e2e/
    task-DR-8-4.spec.ts  # CREATE — 8 state specs
```

### Known Gotchas

```typescript
// CRITICAL: The 8 states are rendered PRE-GRANTED. Sidebar / Toolbar are NOT mounted.
// Do not import any React primitive from src/ui/primitives/ inside the error surface.
// The cards must render with only index.css + cards.css + tokens.css available.

// CRITICAL: errorStates.spec.ts expects a very specific DOM shape. Do NOT change the
// testid attributes, role, aria-live values, or the copy text.

// CRITICAL: The divider is structural — screen readers ignore <hr>; we DON'T need
// aria-hidden. The retry button remains focus-reachable via Tab from the body text.

// CRITICAL: Reduced-motion block MUST disable the square→pill animation explicitly.
// A `@media (prefers-reduced-motion: reduce)` rule zeroes out duration on .card-retry.

// CRITICAL: The card panel bg must sit on top of the PAGE bg. Because the full
// viewport .card container has no bg, the card body element (can be the `.card-inner`
// or reuse `.card` with flex-center displayed via a nested `<div class="card-panel">`)
// owns the `var(--color-panel)`. EITHER:
//   (a) refactor CSS so `.card` has the panel bg + centered layout via flex around it
//   (b) add a wrapping .card-panel element in the TSX and leave `.card` as the
//       fullscreen flex container.
// Option (b) is cleanest but requires a single-line TSX edit. Pick (b).

// CRITICAL: All three .tsx files (PrePromptCard, ErrorStates) need the same shape:
//     <div class="card" role="alert|dialog" aria-live="polite|..." data-testid=...>
//       <div class="card-panel">
//         <h2 class="card-title" id="...">Title</h2>
//         <hr class="card-divider" />
//         <p class="card-body">Body</p>
//         {retry && <button class="card-retry" ...>Retry</button>}
//       </div>
//     </div>

// CRITICAL: Biome formats CSS files too; keep the file properly formatted.

// CRITICAL: The E2E spec runs in dev mode — fake webcam returns GRANTED within a
// few hundred ms. To assert each error state, use the dev hook
// __handTracker.forceState('USER_DENIED') if it exists (see playwright-e2e-webcam
// skill for hook availability). If the hook doesn't exist, force via `page.evaluate`
// that dispatches a permissions event — fallback to a unit-level test for state
// rendering and a single E2E check for PROMPT.
```

---

## Implementation Blueprint

### Step 1: Rewrite `src/ui/cards.css`

The restyle is applied directly to the existing `.card` element via a modifier class `.card-panel` co-applied with `.card`. DOM shape stays identical — no new wrapper `<div>` is introduced (preserves DR14 structural invariant + any chained E2E selectors).

```css
.card {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  font-family: var(--font-family);
  color: var(--color-text-primary);
  padding: var(--space-24);
  z-index: 50;
}

/* Shared panel styling — applied to .card as an additional class. No new DOM node. */
.card-panel {
  max-width: 480px;
  width: 100%;
  padding: var(--space-32);
  background: var(--color-panel);
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.card-title {
  margin: 0;
  font-size: var(--font-size-l);
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
}

.card-divider {
  border: 0;
  border-top: 1px solid var(--color-divider);
  margin: 0;
}

.card-body {
  margin: 0;
  font-size: var(--font-size-m);
  font-weight: 500;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.card-retry {
  align-self: flex-start;
  padding: var(--space-12) var(--space-24);
  font: inherit;
  font-weight: 500;
  color: var(--color-text-primary);
  background: var(--color-button-secondary-bg);
  border: none;
  border-radius: 0;
  cursor: pointer;
  transition:
    border-radius var(--duration-short) var(--ease-default),
    background-color var(--duration-short) var(--ease-default) 0.1s;
}
.card-retry:hover {
  background: var(--color-button-secondary-bg-hover);
  border-radius: var(--radius-pill);
}
.card-retry:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .card-retry {
    transition-duration: 0s;
  }
}
```

### Step 2: Modify `src/ui/PrePromptCard.tsx`

Add `card-panel` as a second class on the existing `.card` element (no new wrapper `<div>`). Insert a `<hr class="card-divider" />` between title and body.

```tsx
export function PrePromptCard({ onAllow }: Props): JSX.Element {
  const copy = errorCopy.PROMPT;
  return (
    <div
      className="card card-panel"
      role="dialog"
      aria-live="polite"
      aria-labelledby="prp-title"
      data-testid="error-state-card-PROMPT"
    >
      <h2 id="prp-title" className="card-title">{copy.title}</h2>
      <hr className="card-divider" />
      <p className="card-body">{copy.body}</p>
      <button type="button" className="card-retry" onClick={onAllow}>
        {copy.retryLabel}
      </button>
    </div>
  );
}
```

### Step 3: Modify `src/ui/ErrorStates.tsx`

Add `card-panel` as a co-class on each `.card` root + insert `<hr class="card-divider" />` between `.card-title` and `.card-body`. No new wrapper div. Preserve the existing state → copy mapping + role="alert" + testid.

### Step 4: E2E spec `tests/e2e/task-DR-8-4.spec.ts`

Scope for DR-8.4: assert only the two states that are reachable without JS stubs — PROMPT (default landing state before any permission decision) and GRANTED (the fake-webcam path). The full 8-state matrix is covered in DR-9.2, which introduces `addInitScript`-based stubs for the denied / NOT_FOUND / etc. branches.

```typescript
import { test, expect } from '@playwright/test';

test.describe('Task DR-8.4: PROMPT + GRANTED cards render with new palette', () => {
  test('PROMPT card: divider + panel background token', async ({ browser }) => {
    // Fresh context with NO camera permission grant; the app lands on PROMPT.
    const context = await browser.newContext({ permissions: [] });
    const page = await context.newPage();
    await page.goto('/');

    const card = page.getByTestId('error-state-card-PROMPT');
    await expect(card).toBeVisible();
    await expect(card.locator('.card-divider')).toBeVisible();
    const bg = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
    // --color-panel = #151515 = rgb(21, 21, 21)
    expect(bg).toBe('rgb(21, 21, 21)');

    await context.close();
  });

  test('GRANTED path: no error card shown', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="camera-state"]')?.textContent === 'GRANTED',
    );
    await expect(page.getByTestId('error-state-card-PROMPT')).toHaveCount(0);
  });
});
```

The remaining 6 error-state visuals (USER_DENIED, SYSTEM_DENIED, DEVICE_CONFLICT, NOT_FOUND, MODEL_LOAD_FAIL, NO_WEBGL) are asserted by DR-9.2's rewritten error-state spec. DR-8.4 only owns the restyle; the state-matrix coverage is a DR-9.2 deliverable.

### Step 5: (optional but recommended) snapshot a visual reference

Capture `reports/DR-8-4/pre-prompt-card.png` (Playwright screenshot) and commit it under `.claude/orchestration-design-rework/reports/DR-8-regression/` (DR-8.R will add more). This step is optional for DR-8.4 but helps the regression task.

---

## Validation Loop

### Level 1

```bash
pnpm biome check src/ui/cards.css src/ui/PrePromptCard.tsx src/ui/ErrorStates.tsx
pnpm tsc --noEmit
```

### Level 2

```bash
pnpm vitest run src/ui/ErrorStates.test.tsx
pnpm vitest run
```

### Level 3

```bash
pnpm build
```

### Level 4

```bash
pnpm test:setup
pnpm test:e2e --grep "Task DR-8.4:"
# Run the legacy error-states spec by filename (describe prefix does not contain "errorStates"; at DR-8.4 time the file is still camelCase — DR-9.2 renames to error-states.spec.ts with `git mv`).
pnpm test:e2e tests/e2e/errorStates.spec.ts
```

---

## Final Validation Checklist

### Technical
- [ ] All 4 levels exit 0
- [ ] `grep -E '#[0-9a-fA-F]{3,6}' src/ui/cards.css` empty
- [ ] 8 testids render under new styles
- [ ] Reduced-motion branch collapses transitions

### Feature
- [ ] Divider visible between title and body on every card
- [ ] Panel bg matches `--color-panel` (#151515)
- [ ] JetBrains Mono applied (body inherits)
- [ ] Retry button animates square → pill on hover
- [ ] Focus-ring shows the `var(--color-focus-ring)` blue

### Code Quality
- [ ] No hex literals in cards.css
- [ ] Testids + role + aria-live + copy strings all preserved
- [ ] No import from primitives/ in error UI

---

## Anti-Patterns

- Do not change copy strings in errorCopy.ts.
- Do not remove or rename existing testids — 8 E2E specs depend on them.
- Do not import React primitives (Button, etc.) into the error cards — they must be pre-GRANTED-safe.
- Do not hardcode hex values; only tokens.
- Do not restructure PropTypes or onClick handlers.

---

## No Prior Knowledge Test

- [ ] 8 testid strings listed verbatim
- [ ] DR/§-numbers cited exist (DR5, DR7, DR11, DR14)
- [ ] Cited files exist (cards.css, PrePromptCard.tsx, ErrorStates.tsx, errorCopy.ts, tokens.css)
- [ ] Validation commands copy-paste runnable

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/webcam-permissions-state-machine/SKILL.md
.claude/skills/design-tokens-dark-palette/SKILL.md
.claude/skills/playwright-e2e-webcam/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
```
