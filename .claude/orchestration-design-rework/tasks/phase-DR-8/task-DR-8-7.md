# Task DR-8.7: Footer

**Phase**: DR-8 — Chrome Integration
**Branch**: `task/DR-8-7-footer`
**Commit prefix**: `Task DR-8.7:`
**Estimated complexity**: Small
**Max Ralph iterations**: 10

---

## Goal

**Feature Goal**: Add a small bottom-row footer under the app body displaying `hand-tracker-fx v0.1.0 ······ Built with MediaPipe, ogl, React`. Muted text color (`var(--color-text-muted)`). Hidden on error and pre-prompt screens — only renders when camera state is `GRANTED`.

**Deliverable**:
- `src/ui/Footer.tsx` + `Footer.module.css`
- `src/ui/Footer.test.tsx` — unit coverage (visibility, copy, color token)
- `src/App.tsx` — mount `<Footer />` inside the GRANTED branch, below `.app-body`
- `tests/e2e/task-DR-8-7.spec.ts` — Playwright L4

**Success Definition**: Footer renders exactly once in GRANTED state. Text content matches spec verbatim. Computed color matches `var(--color-text-muted)`. Hidden on every error-state card render.

---

## User Persona

**Target User**: Any user who wants to know what the app is and what it's built with.

**Use Case**: Opens app, sees camera, uses it. Scrolls eye to bottom of viewport, sees small credit text.

**User Journey**:
1. App GRANTED. User sees toolbar + stage + sidebar.
2. User glances at the bottom edge — sees `hand-tracker-fx v0.1.0 ······ Built with MediaPipe, ogl, React`.
3. Color is muted grey; text is unobtrusive.

**Pain Points Addressed**: No attribution currently in the UI; footer gives it a home without a feedback button (DR18 bans that).

---

## Why

- DR18 — Keep a simplified footer.
- No "Leave feedback" button (no channel).
- Muted text color, hidden on error/pre-prompt.
- Depends on DR-8.6 (App.tsx composition with `.app-layout` / `.app-body`). Non-blocking for DR-8.R.

---

## What

- `Footer` is a bare `<footer data-testid="footer">` element
- Content: two inline spans — left "hand-tracker-fx v0.1.0", right "Built with MediaPipe, ogl, React" — separated by a dotted spacer (CSS `border-bottom: 1px dotted` OR unicode `·` repeated 6× as a literal). Keep it literal: `······` (6 middle-dot U+00B7 characters) between the two labels.
- Visible only when `state === 'GRANTED'` — rendered inside the same conditional branch as Stage/Sidebar in App.tsx.
- Styling:
  - Height: `var(--space-36)` (`3.6rem` ~40px)
  - Padding: `0 var(--space-24)`
  - Display: flex, align-items center, gap `var(--space-16)`
  - Font: inherits body; `font-size: var(--font-size-xs)`
  - Color: `var(--color-text-muted)` (`#8F8F8F`)
  - Background: `var(--color-bg)` (blends with page)

### Version source

Hardcode `v0.1.0` directly in the component for DR-8.7. DR-9.R (final cut) tags git `v0.1.0` and can later reference `import.meta.env` if needed.

### NOT Building

- No feedback link, no social links, no changelog link.
- No responsive breakpoint adjustments.
- No animations.
- No dynamic version reading from package.json (hardcode).

### Success Criteria

- [ ] `pnpm biome check src/ui/Footer.tsx src/ui/Footer.module.css src/ui/Footer.test.tsx src/App.tsx` exits 0
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] Unit: footer renders text verbatim; color matches token; NOT rendered when the parent hides it
- [ ] L4: Footer visible in GRANTED state; NOT visible on PROMPT / USER_DENIED (test at least one non-GRANTED state via dev hook)

---

## All Needed Context

```yaml
files:
  - path: src/App.tsx
    why: Conditional mount inside the GRANTED branch, after <Sidebar />

  - path: src/ui/tokens.css
    why: color + spacing tokens

skills:
  - hand-tracker-fx-architecture
  - design-tokens-dark-palette
  - prp-task-ralph-loop
  - playwright-e2e-webcam
  - vitest-unit-testing-patterns

discovery:
  - DR18: Footer simplified, no feedback button, muted color, hidden on errors
```

### Desired Codebase Tree

```
src/
  ui/
    Footer.tsx            # CREATE
    Footer.module.css     # CREATE
    Footer.test.tsx       # CREATE
  App.tsx                 # MODIFY — mount <Footer /> in GRANTED branch
tests/
  e2e/
    task-DR-8-7.spec.ts   # CREATE
```

### Known Gotchas

```typescript
// CRITICAL: Footer mounts INSIDE the GRANTED branch in App.tsx — that's the clean
// way to keep it hidden on errors. No `hidden={state !== 'GRANTED'}` attribute
// needed; the branch omits the component entirely.

// CRITICAL: The unicode middle-dot U+00B7 ('·') is the dotted spacer char. Six
// repeated. Verify copy byte-for-byte: 'hand-tracker-fx v0.1.0 ······ Built with MediaPipe, ogl, React'.
// Biome / ESLint shouldn't have opinions on unicode; if a lint rule fires, escape
// via '\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7'.

// CRITICAL: The footer sits INSIDE `.app-layout` (the flex column) AFTER `.app-body`.
// Do NOT make it position: fixed; it's a flex child occupying natural row height.

// CRITICAL: Width — flex-direction: row; justify-content: space-between to split
// the two spans. Add the dotted unicode as the middle span, flex: 1 1 auto,
// text-align center, overflow hidden.
```

---

## Implementation Blueprint

### Step 1: `Footer.tsx`

```tsx
import type { JSX } from 'react';
import styles from './Footer.module.css';

export function Footer(): JSX.Element {
  return (
    <footer className={styles.footer} data-testid="footer">
      <span className={styles.label}>hand-tracker-fx v0.1.0</span>
      <span className={styles.spacer} aria-hidden="true">······</span>
      <span className={styles.label}>Built with MediaPipe, ogl, React</span>
    </footer>
  );
}
```

### Step 2: `Footer.module.css`

```css
.footer {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-16);
  height: var(--space-36);
  padding: 0 var(--space-24);
  background: var(--color-bg);
  color: var(--color-text-muted);
  font-family: var(--font-family);
  font-size: var(--font-size-xs);
  line-height: 1;
  flex: 0 0 auto;
}
.label { flex: 0 0 auto; }
.spacer {
  flex: 1 1 auto;
  text-align: center;
  letter-spacing: 0.3em;
  color: var(--color-text-muted);
  overflow: hidden;
  white-space: nowrap;
}
```

### Step 3: Modify `src/App.tsx`

Inside the `state === 'GRANTED'` JSX, after `<Sidebar />`:

```tsx
{state === 'GRANTED' && (
  <div className="app-layout">
    <Toolbar getCanvas={() => stageRef.current?.overlayCanvas ?? null} />
    <div className="app-body">
      <Stage ... />
      <Sidebar
        presetStripSlot={<PresetStrip />}
        modulationSlot={<ModulationCard />}
      />
    </div>
    <Footer />  {/* NEW */}
    {trackerError ? <p data-testid="tracker-error" hidden>tracker error</p> : null}
  </div>
)}
```

### Step 4: Unit test `Footer.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Footer } from './Footer';

describe('Footer', () => {
  it('renders version + credit copy', () => {
    render(<Footer />);
    expect(screen.getByText('hand-tracker-fx v0.1.0')).toBeInTheDocument();
    expect(screen.getByText('Built with MediaPipe, ogl, React')).toBeInTheDocument();
  });

  it('has muted color token via computed style', () => {
    const { getByTestId } = render(<Footer />);
    const el = getByTestId('footer');
    // jsdom doesn't resolve CSS vars; assert class presence only
    expect(el).toHaveAttribute('data-testid', 'footer');
    expect(el.tagName).toBe('FOOTER');
  });
});
```

### Step 5: E2E spec

```typescript
import { test, expect } from '@playwright/test';

test.describe('Task DR-8.7: footer visible post-GRANTED', () => {
  test('footer visible in GRANTED state', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="camera-state"]')?.textContent === 'GRANTED',
    );
    const footer = page.getByTestId('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('hand-tracker-fx v0.1.0');
    await expect(footer).toContainText('Built with MediaPipe, ogl, React');
    const color = await footer.evaluate((el) => getComputedStyle(el).color);
    // #8F8F8F = rgb(143, 143, 143)
    expect(color).toBe('rgb(143, 143, 143)');
  });

  test('footer hidden on PROMPT state', async ({ browser }) => {
    // Fresh context without granted permission — lands on PROMPT; Footer should not render.
    const context = await browser.newContext({ permissions: [] });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByTestId('error-state-card-PROMPT')).toBeVisible();
    await expect(page.getByTestId('footer')).toHaveCount(0);
    await context.close();
  });
});
```

The footer is rendered conditionally when `state === 'GRANTED'`. The second test above verifies non-GRANTED by opening a browser context with `permissions: []`. The full 8-state coverage lives in DR-9.2 (which uses `addInitScript` stubs for each non-GRANTED state).

---

## Validation Loop

### Level 1

```bash
pnpm biome check src/ui/Footer.tsx src/ui/Footer.module.css src/ui/Footer.test.tsx src/App.tsx
pnpm tsc --noEmit
```

### Level 2

```bash
pnpm vitest run src/ui/Footer.test.tsx
pnpm vitest run
```

### Level 3

```bash
pnpm build
```

### Level 4

```bash
pnpm test:setup
pnpm test:e2e --grep "Task DR-8.7:"
```

---

## Final Validation Checklist

### Technical
- [ ] All 4 levels exit 0
- [ ] No hex / px literals in Footer files
- [ ] Testid `footer` visible in GRANTED, hidden in PROMPT / error states

### Feature
- [ ] Footer text matches verbatim
- [ ] Muted color via token (rgb(143,143,143))
- [ ] No animation / motion

---

## Anti-Patterns

- Do not position fixed — footer is a flex child.
- Do not add a feedback/contact link.
- Do not read version from import.meta.env — hardcode for DR-8.7.
- Do not render footer when state !== GRANTED.

---

## No Prior Knowledge Test

- [ ] Copy text specified verbatim
- [ ] DR-18 cited
- [ ] Validation commands runnable
- [ ] Footer component mount location identified

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/design-tokens-dark-palette/SKILL.md
.claude/skills/playwright-e2e-webcam/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
```
