# Hand Tracker FX

TouchDesigner-style webcam hand-tracking video effects, running entirely in the browser. All processing stays on your device.

MVP effect: a grid overlay + dotted landmark blobs + mosaic/pixelation applied inside the hand-bounded region, with X/Y axis modulation and a live parameters panel.

## Stack

- React 19 + Vite 8 + TypeScript 6 (strict)
- [`@mediapipe/tasks-vision`](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker) HandLandmarker (self-hosted model + wasm)
- [`ogl`](https://github.com/oframe/ogl) WebGL for the mosaic fragment shader
- Canvas 2D overlay for grid + blobs + coordinate labels
- [`tweakpane`](https://tweakpane.github.io/) v4 + Essentials for the parameters panel
- [Biome](https://biomejs.dev) v2, [Vitest](https://vitest.dev) 4, [Playwright](https://playwright.dev)
- [Vercel](https://vercel.com) deploy with `COOP: same-origin` + `COEP: require-corp`

## Quickstart

Prerequisites: Node 20+, pnpm 10+, ffmpeg (for E2E).

```bash
pnpm install
pnpm fetch:assets    # one-time: downloads MediaPipe model + wasm to public/
pnpm test:setup      # one-time: generates tests/assets/fake-hand.y4m
pnpm dev             # http://localhost:5173
```

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Vite dev server with COOP/COEP headers |
| `pnpm build` | Production build to `dist/` |
| `pnpm preview` | Serve the prod build locally on :4173 (COOP/COEP) |
| `pnpm typecheck` | `tsc -b --noEmit` |
| `pnpm lint` / `pnpm lint:fix` | Biome check / autofix |
| `pnpm test` / `pnpm test:watch` | Vitest unit tests |
| `pnpm test:e2e` | Playwright E2E (requires `pnpm test:setup` first) |
| `pnpm check` | typecheck + lint + unit tests — the pre-commit gate |

## Project layout

See `src/effects/`, `src/engine/`, `src/tracking/`, `src/camera/`, `src/ui/`. Structure is planned in `.claude/orchestration-hand-tracker-fx/DISCOVERY.md` §9.

## Orchestration

This project is being built via a multi-phase orchestration plan:

- Top authority: [`.claude/orchestration-hand-tracker-fx/DISCOVERY.md`](.claude/orchestration-hand-tracker-fx/DISCOVERY.md)
- Plan: `.claude/orchestration-hand-tracker-fx/PHASES.md` (generated in Phase 9)
- Task files: `.claude/orchestration-hand-tracker-fx/tasks/phase-N/task-N-M.md`
- Progress: `.claude/orchestration-hand-tracker-fx/PROGRESS.md`

Task files use the [Rasmus Widing PRP](https://github.com/Wirasm/PRPs-agentic-eng) format with 4-level validation loops.

## Privacy

All webcam processing happens locally in your browser. No frames, landmarks, or presets are sent to any server.
