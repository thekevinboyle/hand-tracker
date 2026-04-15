# Phase 1 — Foundation

**Phase goal**: Ship a production-grade scaffold, a full 8-state webcam permission hook, all 8 error-state UI cards, a GPU-first MediaPipe HandLandmarker singleton, a `requestVideoFrameCallback`-driven render loop, and a mirror-aware stacked-canvas Stage — so every subsequent phase can assume `pnpm check` is green, `crossOriginIsolated === true` on `pnpm preview`, and landmarks arrive on every frame.

**Authority**: [DISCOVERY.md](../../DISCOVERY.md) overrides everything. D13 (Chromium desktop only), D16 (tech stack), D21 (testing), D22-D27 (webcam + mirror semantics), D31-D33 (headers + asset hosting), D36-D38 (engine shape), D41-D42 (PRP task format + phase regression) are the controlling decisions for this phase.

**Reference screenshot**: `.claude/orchestration-hand-tracker-fx/reference-assets/touchdesigner-reference.png` — visual target is NOT exercised in Phase 1 (Stage renders black canvases; mosaic is Phase 3). Kept here so the agent knows what Phase 3 + 4 will light up.

**Prior state (end of Phase 0 / orchestration)**:
- Vite 8 + React 19 + TypeScript 6 strict scaffold wired
- `vite.config.ts` exports `SECURITY_HEADERS` (COOP/COEP) on dev + preview
- `vercel.json` mirrors the header stack for deploy
- `playwright.config.ts` wires Chromium + `--use-fake-device-for-media-stream` + Y4M fake video
- `scripts/gen-fake-webcam.mjs` + `scripts/fetch-mediapipe-assets.mjs` present
- MediaPipe model + 6 wasm files self-hosted under `public/models/` + `public/wasm/`
- `pnpm check` script composes `pnpm lint && pnpm typecheck && pnpm vitest run`

Phase 1 turns this empty-but-hardened scaffold into a live camera → landmarks → rVFC render loop.

---

## Tasks

| ID | Title | Complexity | Max Iter | Branch | Key deliverable |
|---|---|---|---|---|---|
| 1.1 | Harden scaffold + wire CI gate | Medium | 20 | `task/1-1-scaffold-ci` | `.github/workflows/ci.yml` + `tests/e2e/smoke.spec.ts` + root `CLAUDE.md` |
| 1.2 | `useCamera` 8-state permission hook | High | 30 | `task/1-2-usecamera-state-machine` | `src/camera/useCamera.ts` + `cameraState.ts` + `mapError.ts` + tests |
| 1.3 | 8 error-state cards + pre-prompt card | Medium | 20 | `task/1-3-error-state-ui` | `src/ui/ErrorStates.tsx` + `PrePromptCard.tsx` + `errorCopy.ts` |
| 1.4 | MediaPipe HandLandmarker init + singleton | High | 30 | `task/1-4-mediapipe-handlandmarker` | `src/tracking/handLandmarker.ts` + `errors.ts` |
| 1.5 | `requestVideoFrameCallback` render loop | High | 30 | `task/1-5-rvfc-render-loop` | `src/engine/renderLoop.ts` + `types.ts` + `devHooks.ts` |
| 1.6 | Stage — video + mirror-aware stacked canvases | Medium | 20 | `task/1-6-stage-mirror-canvas` | `src/ui/Stage.tsx` + `Stage.css` |
| 1.R | Phase 1 regression | Medium | 20 | `task/1-R-phase-1-regression` | L1-L4 green on `pnpm preview` + MCP walkthrough report |

**Total**: 7 tasks.

---

## Dependency Graph (within phase)

```
1.1 scaffold + CI gate
    │
    ▼
1.2 useCamera (8-state machine)  ────────┐
    │                                    │
    ▼                                    │
1.3 ErrorStates + PrePromptCard          │
    (depends on 1.2's cameraState enum)  │
                                         ▼
1.4 HandLandmarker singleton (needs a live <video> from 1.2)
    │
    ▼
1.5 renderLoop (rVFC on video; calls detectForVideo from 1.4)
    │
    ▼
1.6 Stage (video + 2 canvases; provides refs the loop consumes)
    │
    ▼
1.R Phase 1 regression (all of 1.1-1.6 on pnpm preview)
```

- 1.1 is the root — every later task runs its L1-L4 against the CI gate 1.1 establishes.
- 1.2 and 1.3 share the `cameraState` enum; 1.3 imports it read-only from 1.2.
- 1.4 consumes a `<video>` element — in 1.4 that is a minimal inline element in App.tsx; 1.6 replaces it with `<Stage>`.
- 1.5 assumes 1.4's singleton is available; it wires `detectForVideo(video, nowMs)` into the rVFC callback.
- 1.6 is last (the visible composition); it swaps App.tsx's inline video for `<Stage>` and lifts the three refs out via `useImperativeHandle`.
- 1.R is the regression gate — it runs after every other Phase 1 task has merged.

No intra-phase parallelism: Ralph runs these sequentially. 1.2 and 1.3 *could* parallelize after the shared enum is extracted, but the cost of coordinating the shared file outweighs the time saved for a 20-iteration task.

---

## Phase Entry Assumptions (from Phase 0)

- `package.json` exposes `dev`, `build`, `preview`, `lint`, `typecheck`, `check`, `test`, `test:setup`, `test:e2e`.
- `pnpm install --frozen-lockfile` succeeds on a clean checkout.
- MediaPipe model + wasm are present under `public/` (verified by `scripts/fetch-mediapipe-assets.mjs` during scaffold setup).
- `vite.config.ts` and `vercel.json` both declare the full COOP/COEP header stack — any drift MUST be fixed in BOTH in the same commit.
- No feature code in `src/App.tsx` beyond the scaffold heading — Phase 1 Task 1.2 is the first task that imports anything from `src/camera/`.

If any of the above is missing, return to Phase 0 before running Phase 1 Ralph.

---

## What Phase 1 Does NOT Build

- Effect registry / paramStore / Tweakpane panel (Phase 2)
- Grid / dotted blobs / coord labels (Phase 2)
- Mosaic WebGL shader / hand-polygon mask (Phase 3)
- Modulation evaluator / X+Y modulation routes (Phase 4)
- Presets + chevron cycler + MediaRecorder (Phase 4)
- Reduced-motion gating for animation (Phase 4; Phase 1 only honors reduced-motion on the static state cards)
- Vercel deploy + live preview URL (Phase 5)
- Visual-regression screenshot diff (Phase 5.6)
- Service worker (deferred to Phase 5 per D33)
- Firefox / WebKit Playwright projects — Chromium only per D13

---

## Cross-Task Gotchas

These bite more than once across Phase 1 — read them on entry, not just from individual task files.

- **`--grep` escape**: Every L4 run uses `pnpm test:e2e --grep "Task N.M:"`. The describe block MUST start with EXACTLY `Task N.M:` (colon included). `--grep "Task 1"` without the dot over-matches future Phase 10+. The regression task uses `--grep "Task 1\\."` (escaped dot) to union the six Phase 1 specs.
- **StrictMode double-mount**: React 19 dev runs every `useEffect` twice. Every cleanup must be idempotent: `tracks.forEach(t => t.stop())`, `video.cancelVideoFrameCallback(id)`, `cancelAnimationFrame(id)`, `videoRef.srcObject = null`. This bites 1.2 (camera open twice), 1.4 (GPU context leak from double `.close()`), 1.5 (double rVFC registration), 1.6 (double srcObject assign — benign but noisy).
- **Mirror semantics (D27)**: Landmark coordinate space is ALWAYS unmirrored. CSS `transform: scaleX(-1)` is applied ONLY to the display canvases in 1.6. Never mirror the `<video>` element. Never apply `1 - x` corrections to landmarks. 1.2 captures raw pixels; 1.4 inferences on raw pixels; 1.5 carries raw landmarks in `FrameContext`; 1.6 mirrors the composited output only.
- **`pnpm` only**: CI uses `pnpm/action-setup@v4` reading the version from `packageManager` in `package.json`. A stray `npm install` generates a `package-lock.json` that breaks every later agent's `pnpm install --frozen-lockfile`. If you see `package-lock.json` in the working tree, delete it and check .gitignore.
- **`crossOriginIsolated` is the source of truth**: A malformed COEP header can still be returned in the response. The only reliable assertion is `await page.evaluate(() => crossOriginIsolated)`. 1.1's smoke spec bakes this in; 1.R re-asserts it via MCP.
- **MediaPipe timestamps**: `detectForVideo(video, nowMs)` requires monotonically increasing `nowMs`. The rVFC callback's `now` argument is the correct source; `performance.now()` from rAF is NOT a match. 1.5 wires `nowMs` from the rVFC `VideoFrameCallbackMetadata` — do not substitute.
- **`preserveDrawingBuffer: true`**: 1.6 ensures the WebGL canvas element is ready to be requested with this flag in Phase 3; forgetting it makes Phase 4's `canvas.captureStream()` produce black frames with no warning. 1.6's task file sets the attribute on the canvas `data-*` wiring so Phase 3.1 inherits it.
- **`data-testid="camera-state"`**: Added in 1.2, preserved in 1.3 (moved offscreen via absolute positioning), preserved in 1.6 (kept inside the `<main>` sibling of `<Stage>`). Every Phase 1 E2E relies on it; every later phase + 1.R does too. Never remove.
- **Dev hooks gating**: `window.__handTracker.getFPS()` and `.getLandmarkCount()` are exposed by 1.5 under `import.meta.env.DEV || import.meta.env.MODE === 'test'`. The Playwright webServer runs `pnpm build --mode test`, so hooks are defined at preview time. 1.R's MCP walkthrough uses `pnpm build --mode test && pnpm preview` for the same reason — a plain prod build hides the hooks.
- **Header drift**: `vite.config.ts` `SECURITY_HEADERS` and `vercel.json` `headers[]` must be character-identical. 1.1 sets the initial pair; 1.R's `scripts/check-headers.sh` is the regression gate; Phase 5 reuses the same script against the live Vercel URL.
- **Y4M fake-hand is a test card**: The synthetic fake-hand.y4m (ffmpeg testsrc2) produces zero landmarks from MediaPipe. L4 assertions in 1.4 and 1.5 must read `landmarkCount >= 0` (or `>= 1` only where a real-hand fixture is loaded). Real-hand Y4M is a Phase 5.6 nice-to-have.

---

## Validation Contract (per task)

Every task in this phase ships all 4 validation levels. Scoped commands:

- **L1**: `pnpm lint <paths> && pnpm typecheck` → zero errors
- **L2**: `pnpm vitest run <unit-test-file>` → all tests pass
- **L3**: `pnpm build` (or targeted integration script) → exits 0
- **L4**: `pnpm test:e2e --grep "Task 1.N:"` → the single Phase 1 spec for this task passes

The regression task (1.R) runs all four against a fresh `pnpm build && pnpm preview` plus a manual Playwright MCP walkthrough. The Ralph loop self-heals until all four exit 0.

---

## Skills Used Across Phase 1

Read on phase entry, re-read per-task as the task file directs:

- `.claude/skills/hand-tracker-fx-architecture/SKILL.md` — top-level orientation, folder structure, data flow
- `.claude/skills/prp-task-ralph-loop/SKILL.md` — task anatomy, 4-level validation, Ralph protocol
- `.claude/skills/vite-vercel-coop-coep/SKILL.md` — header invariants for 1.1 and 1.R
- `.claude/skills/playwright-e2e-webcam/SKILL.md` — fake-device flags, CI wiring, MCP walkthrough pattern
- `.claude/skills/webcam-permissions-state-machine/SKILL.md` — 8-state machine for 1.2 and 1.3
- `.claude/skills/mediapipe-hand-landmarker/SKILL.md` — GPU/CPU init + landmark schema for 1.4 and 1.5
- `.claude/skills/vitest-unit-testing-patterns/SKILL.md` — jsdom + canvas-mock for every L2

---

## DISCOVERY Decisions Satisfied in Phase 1

| D-number | Summary | Task(s) |
|---|---|---|
| D13 | Chromium desktop 120+ only; Firefox/WebKit out of scope | 1.1 |
| D16 | Tech stack — React 19, Vite 8, TS 6 strict, pnpm 10, Biome 2, Vitest 4, Playwright 1.59 | 1.1 |
| D21 | Vitest + Playwright-with-fake-device | 1.1, 1.2, 1.4, 1.5, 1.6 |
| D22 | `getUserMedia({ video: { width:1280, height:720, frameRate:30, facingMode:'user' }, audio:false })` | 1.2 |
| D23 | 8 permission states with distinct UI | 1.2, 1.3 |
| D24 | Device selection UX + `localStorage` key | 1.2 |
| D25 | Cleanup on unmount — `track.stop()` idempotent | 1.2, 1.6 |
| D26 | Reduced motion — no animation on state cards | 1.3 |
| D27 | Webcam source truth unmirrored; CSS mirror on display only | 1.6 |
| D31 | Vercel headers | 1.1, 1.R |
| D32 | Dev-server headers mirror production | 1.1, 1.R |
| D33 | Self-host MediaPipe model + wasm under `public/` | 1.4 |
| D37 | `FrameContext` shape passed per frame | 1.5 |
| D39 | Trunk-based git, `task/N-M-<description>` branches | all |
| D40 | Commit convention `Task N.M: <description>` + Co-Authored-By trailer | all |
| D41 | PRP task-file format + 4 validation levels | all |
| D42 | Phase regression against `pnpm preview` | 1.R |

---

## Exit Criteria for Phase 1

- All 7 task files emit `<promise>COMPLETE</promise>` from the Ralph loop
- `pnpm check` exits 0 on a clean checkout from `main`
- `pnpm build && pnpm preview` serves :4173 with COOP/COEP/CSP/Permissions-Policy/Referrer-Policy headers
- `pnpm test:e2e --grep "Task 1\\."` passes 6/6 Phase 1 specs
- `pnpm test:e2e --grep "Task 1.R:"` passes the 10-second soak spec
- Playwright MCP walkthrough: `PROMPT → GRANTED`, `window.__handTracker.getFPS() > 0` after 3 s warmup, `getLandmarkCount() >= 0`, zero console errors, zero unhandled rejections
- `scripts/check-headers.sh http://localhost:4173` exits 0
- `reports/phase-1-regression.md` + `reports/phase-1-regression-granted.png` committed
- Next phase can start: Phase 2 Task 2.1 consumes `src/engine/` and `src/ui/Stage.tsx` unchanged; `App.tsx`'s GRANTED branch renders `<Stage>` ready to receive an overlay renderer
