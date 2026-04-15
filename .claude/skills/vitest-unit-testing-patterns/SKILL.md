---
name: vitest-unit-testing-patterns
description: Use when writing Level-2 (unit) tests for Hand Tracker FX. Vitest 4 + jsdom + @testing-library/react + vitest-canvas-mock, deterministic seeded tests for RNG code, proper MediaPipe + getUserMedia mocking, StrictMode-aware patterns.
---

# Vitest Unit Testing Patterns (Hand Tracker FX)

Implementation reference for **Level-2 (unit)** tests in the PRP validation
loop. L1 = lint/type (`biome` + `tsc`). L2 = this skill. L3 = integration
(rarely used on this project). L4 = Playwright E2E with
`--use-fake-device-for-media-stream` (camera + WebGL).

Source of truth: DISCOVERY.md **D21** (testing scope) and **D41** (PRP
validation loop).

---

## 1. Environment (already wired up)

`vite.config.ts` — the `test` block:

```ts
test: {
  environment: 'jsdom',        // DOM globals, no Canvas 2D, no WebGL
  globals: true,               // describe/it/expect/vi without imports
  setupFiles: ['./src/test/setup.ts'],
  include: ['src/**/*.test.{ts,tsx}'],
  exclude: ['node_modules', 'dist', 'tests/e2e/**'],
}
```

`src/test/setup.ts` — runs once before every test file:

```ts
import '@testing-library/jest-dom/vitest';   // toBeInTheDocument, etc.
import 'vitest-canvas-mock';                 // stubs getContext('2d')
```

Why `vitest-canvas-mock` matters: JSDOM 25 ships no Canvas 2D implementation.
Any code that calls `canvas.getContext('2d')` during import/construction will
throw `TypeError: canvas.getContext is not a function` without this. It does
**not** mock WebGL — WebGL code must be guarded or tested in Playwright.

Versions locked by `package.json`:

| Package | Version |
|---|---|
| vitest | ^4.1.4 |
| jsdom | ^25.0.0 |
| vitest-canvas-mock | ^0.3.3 |
| @testing-library/react | ^16.1.0 |
| @testing-library/jest-dom | ^6.6.0 |

---

## 2. File naming + location

- Colocate with source: `src/engine/modulation.ts` → `src/engine/modulation.test.ts`.
- Use `.test.ts` for pure logic, `.test.tsx` for React component tests.
- E2E specs live in `tests/e2e/**` (Playwright) and are excluded from Vitest.

---

## 3. Unit test targets (what to test at L2)

Per D21, Vitest is **only** for pure utilities. Each of these modules must
ship with a `.test.ts`:

| Module | Function | Why unit |
|---|---|---|
| `src/engine/grid.ts` | seeded column-width generator | pure RNG → deterministic |
| `src/engine/modulation.ts` | `evalCurve(t, curve)` | pure math |
| `src/engine/overlap.ts` | polygon ↔ grid-cell area | pure geometry |
| `src/preset/serialize.ts` | `toJSON`/`fromJSON` + migrations | pure I/O shape |
| `src/state/errors.ts` | `reduce(state, event)` state machine | pure reducer |
| `src/ui/pane.ts` | `pane.exportState()` schema snapshot | schema guardrail |

**Never** unit-test in Vitest:

- The render loop (canvas blits, WebGL programs) — goes to L4.
- The MediaPipe `HandLandmarker.detectForVideo` call path — mock the module.
- Real camera / `getUserMedia` — mock it.

---

## 4. Patterns

### 4.1 Deterministic seeded tests

Anything RNG-driven must accept a seed and be tested against locked fixtures.
Default project seed: **D4 grid seed = `0x1A2B3C4D`**.

```ts
// src/engine/grid.test.ts
import { describe, expect, it } from 'vitest';
import { generateColumnWidths } from './grid';

describe('generateColumnWidths', () => {
  it('produces deterministic widths for the D4 seed', () => {
    const widths = generateColumnWidths({ seed: 0x1a2b3c4d, count: 6, total: 1920 });
    expect(widths).toEqual([287, 451, 198, 362, 414, 208]); // locked fixture
    expect(widths.reduce((a, b) => a + b, 0)).toBe(1920);
  });

  it('differs when the seed differs', () => {
    const a = generateColumnWidths({ seed: 1, count: 6, total: 1920 });
    const b = generateColumnWidths({ seed: 2, count: 6, total: 1920 });
    expect(a).not.toEqual(b);
  });
});
```

If you regenerate the algorithm, update the fixture **intentionally** in the
same PR — a changed fixture is a changed contract.

### 4.2 Modulation curve eval

```ts
// src/engine/modulation.test.ts
import { describe, expect, it } from 'vitest';
import { evalCurve, type Curve } from './modulation';

const linear: Curve = { kind: 'bezier', p1: [0, 0], p2: [1, 1] };

describe('evalCurve', () => {
  it('returns 0 at t=0 and 1 at t=1', () => {
    expect(evalCurve(0, linear)).toBe(0);
    expect(evalCurve(1, linear)).toBe(1);
  });

  it('is monotonic across a 100-step sweep', () => {
    let prev = -Infinity;
    for (let i = 0; i <= 100; i++) {
      const v = evalCurve(i / 100, linear);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('clamps out-of-range t', () => {
    expect(evalCurve(-0.5, linear)).toBe(0);
    expect(evalCurve(1.7, linear)).toBe(1);
  });
});
```

### 4.3 Mocking `@mediapipe/tasks-vision`

The real package loads a `.wasm` binary and attempts WebGL. In Vitest we
replace it wholesale. Put the mock inline in the tracker test (or hoist to
`src/test/__mocks__/` if it's reused).

```ts
// src/tracker/tracker.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mediapipe/tasks-vision', () => {
  class FakeHandLandmarker {
    static createFromOptions = vi.fn().mockResolvedValue(new FakeHandLandmarker());
    detectForVideo = vi.fn().mockReturnValue({
      landmarks: [[{ x: 0.5, y: 0.5, z: 0 }]],
      handednesses: [[{ categoryName: 'Right', score: 0.99 }]],
    });
    close = vi.fn();
  }
  class FilesetResolver {
    static forVisionTasks = vi.fn().mockResolvedValue({});
  }
  return { HandLandmarker: FakeHandLandmarker, FilesetResolver };
});

import { createTracker } from './tracker';

describe('createTracker', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns landmarks from a single frame', async () => {
    const tracker = await createTracker({ modelAssetPath: '/models/hl.task' });
    const video = document.createElement('video');
    const result = tracker.detect(video, performance.now());
    expect(result.landmarks[0]).toHaveLength(1);
  });
});
```

`vi.mock` is hoisted to the top of the file before imports — keep the factory
self-contained, don't reference outer variables (Vitest will throw
`ReferenceError: Cannot access '...' before initialization`).

### 4.4 Mocking `navigator.mediaDevices.getUserMedia`

Camera hook tests (D23 error state machine paths) need a stubbed
`getUserMedia`. JSDOM doesn't ship one.

```ts
// src/permissions/useCamera.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCamera } from './useCamera';

function stubGetUserMedia(impl: () => Promise<MediaStream>) {
  const mediaDevices = { getUserMedia: vi.fn(impl) };
  Object.defineProperty(navigator, 'mediaDevices', {
    value: mediaDevices,
    configurable: true,
  });
  return mediaDevices.getUserMedia;
}

afterEach(() => vi.restoreAllMocks());

describe('useCamera', () => {
  it('reaches GRANTED when getUserMedia resolves', async () => {
    const fakeStream = { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
    stubGetUserMedia(() => Promise.resolve(fakeStream));
    const { result } = renderHook(() => useCamera());
    await waitFor(() => expect(result.current.state).toBe('GRANTED'));
  });

  it('maps NotAllowedError to DENIED', async () => {
    stubGetUserMedia(() => Promise.reject(Object.assign(new Error('nope'), { name: 'NotAllowedError' })));
    const { result } = renderHook(() => useCamera());
    await waitFor(() => expect(result.current.state).toBe('DENIED'));
  });

  it('maps NotFoundError to NO_CAMERA', async () => {
    stubGetUserMedia(() => Promise.reject(Object.assign(new Error(), { name: 'NotFoundError' })));
    const { result } = renderHook(() => useCamera());
    await waitFor(() => expect(result.current.state).toBe('NO_CAMERA'));
  });
});
```

### 4.5 React component tests (render + role + fireEvent)

```tsx
// src/ui/ErrorScreen.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorScreen } from './ErrorScreen';

describe('<ErrorScreen />', () => {
  it('renders the DENIED copy and retry button', () => {
    const onRetry = vi.fn();
    render(<ErrorScreen state="DENIED" onRetry={onRetry} />);
    expect(screen.getByRole('heading', { name: /camera blocked/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
```

Prefer `getByRole` / `getByLabelText` over `getByTestId`. Query by what a
user sees, not what a developer named.

### 4.6 Tweakpane schema snapshot

A snapshot of `pane.exportState()` is a **schema guardrail** — it fails loudly
when a binding is renamed or removed. This is one of the only snapshots we
allow.

```ts
// src/ui/pane.test.ts
import { describe, expect, it } from 'vitest';
import { buildPane } from './pane';

describe('buildPane', () => {
  it('exports a stable Tweakpane schema', () => {
    const { pane, dispose } = buildPane({ container: document.createElement('div') });
    try {
      expect(pane.exportState()).toMatchSnapshot();
    } finally {
      dispose();
    }
  });
});
```

When you intentionally change the pane, run `pnpm vitest -u src/ui/pane.test.ts`
and review the diff before committing.

### 4.7 StrictMode-safe testing

`src/main.tsx` wraps `<App />` in `<React.StrictMode>`, which double-invokes
effects in development and in `act()`. If an effect path matters (e.g., the
tracker mount/unmount/remount cycle must be idempotent), wrap in `StrictMode`
inside the test too:

```tsx
import { StrictMode } from 'react';
import { render } from '@testing-library/react';

render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Symptoms this catches: leaked MediaPipe instances, double `getUserMedia`
calls, duplicated listeners. If a test only passes without StrictMode, the
effect has a cleanup bug — fix the effect, don't drop StrictMode.

---

## 5. CI + dev workflow

| Command | Purpose |
|---|---|
| `pnpm test` | Run Vitest once (used in `pnpm check`, CI) |
| `pnpm test:watch` | Vitest watch mode with UI |
| `pnpm vitest run src/engine/modulation.test.ts` | PRP L2 targeted command |
| `pnpm vitest run -t 'monotonic'` | Filter by test name |
| `pnpm vitest -u <file>` | Update snapshots for one file |

`pnpm check` runs `typecheck && lint && test` — the gate before merge.

PRP task files embed the exact L2 command for their module, e.g.:

```yaml
validation:
  L2: pnpm vitest run src/engine/modulation.test.ts
```

---

## 6. Anti-patterns (do not do)

- **Snapshotting rendered React trees.** Snapshots on component HTML become
  noise. Assert on roles/text/attributes instead. (Exception: Tweakpane
  schema snapshot in 4.6 — that's a data shape, not rendered output.)
- **Asserting on implementation details.** Don't test `useState` internals,
  hook call order, class names used for styling, or private functions. Test
  the observable contract.
- **Over-mocking.** Mock only the external boundary (MediaPipe,
  `getUserMedia`). Don't mock your own grid/modulation/preset modules when
  testing something that consumes them — let the real code run.
- **Skipping tests** (`it.skip`, `describe.skip`) without a linked TODO and a
  decision recorded in DISCOVERY.md. A skipped test is a lie in CI.
- **Testing the render loop in Vitest.** Canvas pixel output and WebGL live
  in Playwright (L4). `vitest-canvas-mock` does not render; do not assert on
  pixels from it.
- **Running real timers for animation.** Use `vi.useFakeTimers()` +
  `vi.advanceTimersByTime(ms)` if you need to advance time deterministically.

---

## 7. Quick decision flow

```
Is it pure logic (math / data transform / reducer)?   -> Vitest unit test.
Does it touch DOM + user event?                        -> Vitest + @testing-library/react.
Does it call MediaPipe / camera?                       -> Vitest with vi.mock(...).
Does it render to canvas/WebGL or need real FPS?       -> Playwright (L4), not here.
Does it need a browser engine / real webcam fixture?   -> Playwright (L4), not here.
```

When in doubt, err toward L4 — a flaky unit test is worse than a missing one.
