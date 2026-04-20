# Changelog

All notable changes to Hand Tracker FX are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-20

First public release. Browser hand-tracking video effects running entirely on-device. Ships exactly one effect — the Hand Tracking Mosaic — behind a pixelcrash-inspired dark-mode chrome.

### Added (MVP engine, Phases 1–5.1)

- Webcam hand tracker powered by MediaPipe HandLandmarker 0.10.34 (main-thread, GPU delegate with WebGL fallback).
- WebGL mosaic effect (ogl) constrained to a 6-landmark hand polygon (wrist + 5 fingertips).
- Seeded procedural grid overlay with user-tunable non-uniform column widths (Mulberry32 PRNG).
- Canvas 2D overlay drawing 5 dotted fingertip blobs with 3-decimal normalized xy labels.
- X/Y modulation engine with bezier-easing curves; defaults bind landmark[8].x → mosaic.tileSize and landmark[8].y → grid.columnCount.
- Preset save/load/delete/export/import persisted to localStorage; chevron cycler + ArrowLeft/Right keyboard cycling.
- MediaRecorder → .webm download (vp9 with vp8 fallback), no audio, blob-in-memory.
- `prefers-reduced-motion` honored: modulation pauses, rendering continues.
- Full 8-state webcam permission machine (PROMPT, GRANTED, USER_DENIED, SYSTEM_DENIED, DEVICE_CONFLICT, NOT_FOUND, MODEL_LOAD_FAIL, NO_WEBGL) with dedicated full-screen cards.
- Service worker cache-first for `/models/*` and `/wasm/*` (production only).
- Self-hosted MediaPipe model (7.82 MB float16) + 6 wasm files (~52 MB); no CDN at runtime.
- Vercel deployment with COOP `same-origin` + COEP `require-corp` + full CSP + Permissions-Policy `camera=(self)`.

### Added (Phase DR-9 — parent Phase-5 resume)

- GitHub Actions CI (`.github/workflows/ci.yml`) running L1 biome + tsc, L2 vitest, L3 `pnpm build --mode test`, L4 Playwright E2E on every PR + push to main. Caches pnpm store, Playwright browsers, MediaPipe assets. Single-node matrix on node 25.
- GitHub Actions preview-URL gate (`.github/workflows/e2e-preview.yml`) re-running L4 against `PLAYWRIGHT_BASE_URL` on every Vercel `deployment_status: success`.
- Eight Playwright specs in `tests/e2e/error-states.spec.ts` — one per D23 camera state — forcing each failure mode via real JS-level stubs (no URL-param shortcuts): `addInitScript` overrides of `navigator.permissions.query`, `navigator.mediaDevices.getUserMedia`, `navigator.mediaDevices.enumerateDevices`, `HTMLCanvasElement.prototype.getContext`; `context.route` intercept for the MediaPipe model fetch; `context.grantPermissions` for PROMPT and DEVICE_CONFLICT paths.
- Automated visual-fidelity gate in `tests/e2e/visual-fidelity.spec.ts` — 1440×900 viewport capture on default preset, diffed against `reports/DR-8-regression/design-rework-reference.png` with `maxDiffPixelRatio: 0.02`. Runs on every Vercel preview via `e2e-preview.yml`.

### Changed (Design Rework, Phases DR-6–DR-8)

- Replaced Tweakpane with hand-built React chrome: toolbar (wordmark + cell-size Segmented + record), right sidebar (preset strip + LAYER 1 card + MODULATION card), tokens-driven custom primitives (Button, Segmented, Slider, Toggle, ColorPicker, LayerCard, ModulationRow).
- Introduced design-token system in `src/ui/tokens.css` + `src/ui/tokens.ts` — soft-dark palette (page `#0A0A0B`, panel `#151515`, primary text `#EAEAEA`), fluid type scale `clamp(13px, 0.9vw, 16px)`, motion tokens (`--duration-fast`, `--ease-spring`), spacing scale, radii.
- Self-hosted JetBrains Mono (Regular 400 + Medium 500 + SemiBold 600 subset woff2; ~37 KB total) under `public/fonts/` with preload + immutable cache.
- Square → pill border-radius hover animation (DR11) on buttons; square ↔ circle morph toggle via `--ease-spring`. All motion respects `prefers-reduced-motion`.
- Error + pre-prompt cards restyled with the new palette + hairline divider; testids + a11y semantics preserved.
- Preset cycler + preset actions merged into a single preset strip at the top of the sidebar.
- Record button moved from fixed-top-right into the toolbar row.

### Removed

- Tweakpane, @tweakpane/core, @tweakpane/plugin-essentials dependencies.
- TouchDesigner-inspired light-mode styling (superseded by pixelcrash-inspired dark-only chrome per DR5).
- Fixed-position floating record button + preset bar + preset actions (consolidated into sidebar).
- `?forceState=<STATE>` URL-param shortcut in error-state E2E (replaced by real JS-level stubs per DR-9.2).
- Old TouchDesigner reference image archived to `.claude/orchestration-hand-tracker-fx/reference-assets/_historical/` per DR17.

### Deprecated

- Nothing.

### Fixed

- App.tsx now transitions to NO_WEBGL and MODEL_LOAD_FAIL states via a preflight WebGL2 probe + tracker-error classification (WebGLUnavailableError → NO_WEBGL, ModelLoadError → MODEL_LOAD_FAIL). Product gap discovered and fixed during DR-9.2 error-state coverage.
- Synergy-review backlog items tracked separately in `.claude/orchestration-hand-tracker-fx/reports/synergy-review-backlog.md`.

### Security

- Strict CSP with `default-src 'self'`; only `wasm-unsafe-eval` (MediaPipe wasm thread requirement) and `unsafe-inline` styles (unavoidable for inline style attributes on custom primitives) relaxed.
- Cross-origin isolation enforced (`crossOriginIsolated === true` asserted in E2E).
- JetBrains Mono self-hosted under `public/fonts/` with `Cache-Control: public, max-age=31536000, immutable` on `/fonts/*` — preserves same-origin discipline under the strict CSP.
- No telemetry, analytics, error-reporting SaaS, or feedback channel. All processing is on-device.
- Webcam stream never leaves the browser; no network egress for video data.

### Known limitations

- Desktop-only; no mobile layout below 768px (explicit scope decision per parent DISCOVERY §12 + DR non-goal §8).
- No light theme, no audio, no multi-hand, no face detection, no 3D (explicit scope).
- Single effect — `handTrackingMosaic` — shipped. The architecture supports N effects (registry pattern), but only one is wired.
- Visual-fidelity gate sensitive to sub-pixel font-rendering drift across Chromium point releases; 2% tolerance absorbs normal drift but catches structural regressions.

[0.1.0]: https://github.com/thekevinboyle/hand-tracker/releases/tag/v0.1.0
