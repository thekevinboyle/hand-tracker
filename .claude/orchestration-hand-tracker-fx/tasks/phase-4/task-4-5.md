# Task 4.5: Record → MediaRecorder → .webm Download

**Phase**: 4 — Modulation, Presets, Record, A11y
**Branch**: `task/4-5-recorder`
**Commit prefix**: `Task 4.5:`
**Estimated complexity**: Medium
**Max Ralph iterations**: 20

---

## Goal

**Feature Goal**: Implement the Record button and `useRecorder` hook that captures the composited top canvas at 30fps via `canvas.captureStream(30)` → `MediaRecorder` with `video/webm;codecs=vp9` (falling back to vp8), press-to-start / press-to-stop, no audio, no duration cap, then triggers a blob download named `hand-tracker-fx-{ISO-timestamp}.webm`. Displays "REC" + mm:ss elapsed while active.

**Deliverable**:
- `src/ui/useRecorder.ts` — React hook encapsulating MediaRecorder lifecycle
- `src/ui/RecordButton.tsx` — React component (button + REC indicator + elapsed clock)
- `src/ui/useRecorder.test.ts` — Vitest suite with MediaRecorder stubs

**Success Definition**: Clicking Record starts recording (button shows "■ REC 0:05"); clicking again stops and triggers a `.webm` download observable via `a.click()` spy. Browser manual: downloaded file plays back the effect in VLC.

---

## User Persona

**Target User**: Creative technologist capturing a 20-second clip to share on social.

**Use Case**: User performs a hand-mosaic choreography, records 20 seconds, downloads the webm, drops it in iMovie.

**User Journey**:
1. Click Record → button turns red, shows "REC 0:00" ticking up.
2. Perform hand choreography.
3. Click Record again → button returns to default, download appears in browser.
4. Open the .webm in VLC / Chrome → sees the exact canvas output with the effect applied.

**Pain Points Addressed**: Without recording, users can't share results; screenshotting the canvas doesn't capture motion.

---

## Why

- Satisfies D28 (record behavior spec).
- Key success criterion (§13 DISCOVERY): "Record button → press, move around, press again → .webm downloads and plays back the effect".
- CSP `media-src 'self' blob:` is already in `vercel.json` per D31 — this task consumes that.
- No server, no upload — aligns with "nothing leaves your device" (D35).

---

## What

- `useRecorder()` returns `{ isRecording, elapsedMs, start, stop }`.
- `start(canvas)` calls `canvas.captureStream(30)`, constructs `MediaRecorder` with best-available codec, registers `ondataavailable` to accumulate `Blob` chunks, starts a `setInterval` for elapsed-time updates.
- `stop()` calls `recorder.stop()`, builds final `Blob`, triggers `<a download>` click, revokes the object URL.
- Codec selection via `MediaRecorder.isTypeSupported`:
  - Primary: `video/webm;codecs=vp9`
  - Fallback 1: `video/webm;codecs=vp8`
  - Fallback 2: `video/webm`
  - If none supported, throw a typed error and surface to the UI.
- RecordButton renders: red filled circle icon + "REC" + "m:ss" elapsed when recording; default circle icon + "REC" label otherwise.
- The hook receives a canvas ref (the **2D overlay canvas** — `[data-testid="overlay-canvas"]`). After Task 3.4 lands, the 2D overlay pre-composites the WebGL canvas via `ctx.drawImage(webglCanvas, 0, 0)` as step 1 of its per-frame draw — so the overlay's pixel buffer carries `video + mosaic + grid + blobs + labels`. `canvas.captureStream()` on this canvas captures the full composited image.

### NOT Building (scope boundary)

- No audio capture (D28: no audio, D20 scope excludes audio).
- No duration cap (D28).
- No upload / share integration.
- No pause/resume controls (press-press only).
- No format selector UI (vp9 → vp8 fallback is automatic).
- No thumbnail generation.

### Success Criteria

- [ ] `pnpm biome check src/ui/useRecorder.ts src/ui/useRecorder.test.ts src/ui/RecordButton.tsx` exits 0
- [ ] `pnpm tsc --noEmit` exits 0
- [ ] Unit tests: isTypeSupported mock returns vp9 false, vp8 true → recorder uses vp8
- [ ] Unit test: start then stop → createObjectURL called, anchor.click called, revokeObjectURL called
- [ ] Manual browser: 5-second clip records, downloads, plays back in VLC
- [ ] Downloaded `.webm` plays back WITH the mosaic visible — NOT just grid/blobs/labels on a transparent background (verifies Task 3.4's drawImage pre-composite is working)
- [ ] When `params.input.mirror === true`, the recorded pixels are mirrored to match on-screen display (CSS `scaleX(-1)` does not affect `captureStream()`; the mirror flip is applied via `ctx.save(); ctx.scale(-1,1); ctx.translate(-w,0); drawImage(...); ctx.restore();` inside Task 3.4's per-frame step)
- [ ] Elapsed timer updates every 250ms while recording

---

## All Needed Context

```yaml
files:
  - path: src/engine/renderer.ts
    why: Phase 3 Task 3.1 owner; exposes the WebGL canvas. This task does NOT capture that canvas directly.
    gotcha: After Task 3.4 lands, the 2D overlay canvas IS the composited surface — it draws the WebGL canvas first via `ctx.drawImage(webglCanvas, 0, 0)`, THEN grid + blobs + labels on top. Therefore `canvas.captureStream()` must target the 2D overlay (`[data-testid="overlay-canvas"]`), NOT the WebGL canvas. Capturing the WebGL canvas alone would miss the overlay; capturing the overlay alone (pre-3.4) would miss the mosaic. Post-3.4 the overlay carries both.

  - path: src/effects/handTrackingMosaic/manifest.ts
    why: Task 3.4 owner of the per-frame 2D-overlay drawImage pre-composite step. Acceptance for this task depends on that step existing.
    gotcha: If the downloaded .webm shows ONLY grid/blobs/labels on a transparent background (no mosaic), Task 3.4's drawImage step is missing — stop and fix 3.4 before proceeding.

  - path: src/ui/App.tsx
    why: Hosts the RecordButton and owns the top-canvas ref; pass the ref to RecordButton
    gotcha: Must be the same ref used by Canvas2D draw loop; do NOT create a second ref

  - path: vercel.json
    why: Confirms CSP `media-src 'self' blob:` so blob URLs play back (D31)
    gotcha: If testing a different deploy target, verify CSP allows blob: in media-src

urls:
  - url: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
    why: Full API — constructor options, start()/stop(), dataavailable event, state
    critical: ondataavailable fires when start(timeslice) is used OR on stop(); to get all data in one chunk, omit timeslice and rely on the final event

  - url: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static
    why: Static method to probe codec support — runs synchronously, returns boolean
    critical: Chrome 120 supports vp9 by default; Safari 17 may not → must fall back to vp8 or plain webm

  - url: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream
    why: canvas.captureStream(fps) returns a MediaStream with one video track at the specified framerate
    critical: captureStream must be called AFTER the canvas has rendered at least one frame, otherwise the stream stays black

skills:
  - vite-vercel-coop-coep
  - hand-tracker-fx-architecture
  - vitest-unit-testing-patterns

discovery:
  - D28: Record spec — captureStream(30), vp9 → vp8 fallback, no audio, no cap, hand-tracker-fx-{ISO}.webm
  - D31: CSP media-src 'self' blob: — required for blob URL playback
  - D35: Privacy — recording happens entirely on device, no upload
```

### Current Codebase Tree

```
src/
  engine/renderer.ts       # Phase 3 — owns top canvas
  ui/
    App.tsx                # Phase 2
    Panel.tsx
```

### Desired Codebase Tree

```
src/
  ui/
    useRecorder.ts         # CREATE — hook
    useRecorder.test.ts    # CREATE — unit tests
    RecordButton.tsx       # CREATE — React component
    App.tsx                # MODIFY — render <RecordButton canvasRef={topCanvasRef} />
```

### Known Gotchas

```typescript
// CRITICAL: canvas.captureStream(30) starts black if the canvas has never been drawn on.
// In the app, the render loop draws every frame — captureStream can be called at any
// point after mount. In tests, stub captureStream to return a fake MediaStream.

// CRITICAL: MediaRecorder.isTypeSupported is SYNCHRONOUS and returns boolean.
// Build the codec chain once at module load OR at start() call:
//
//   const CODEC_CANDIDATES = [
//     'video/webm;codecs=vp9',
//     'video/webm;codecs=vp8',
//     'video/webm',
//   ] as const
//   function pickMimeType(): string {
//     for (const c of CODEC_CANDIDATES) {
//       if (MediaRecorder.isTypeSupported(c)) return c
//     }
//     throw new Error('No supported webm codec available')
//   }

// CRITICAL: Do NOT pass timeslice to recorder.start(). Without timeslice,
// ondataavailable fires once at stop() with the full blob. Timeslice mode
// would fire repeatedly and force chunk concatenation.

// CRITICAL: The elapsed timer should NOT use setInterval inside the render hot path.
// Use a standalone setInterval(250ms) that updates React state. Clean it up in stop().

// CRITICAL: React StrictMode runs mount effects twice in dev.
// If the hook auto-starts recording on mount (it must NOT), the double-mount would
// start two recorders. Rule: only start on explicit user click.

// CRITICAL: The file name uses an ISO timestamp with colons REPLACED by hyphens
// (Windows filesystems disallow colons in filenames). Example:
//   `hand-tracker-fx-${new Date().toISOString().replace(/:/g, '-')}.webm`

// CRITICAL: After a.click(), schedule `URL.revokeObjectURL(url)` via setTimeout(0)
// or a Promise.resolve().then — revoking synchronously can cancel the download.

// CRITICAL: blob.type should MATCH the recorder.mimeType; do not hardcode 'video/webm'
// if the recorder fell back to vp8.

// CRITICAL: If MediaRecorder is unavailable (older browsers), isTypeSupported never
// runs. Guard with `if (typeof MediaRecorder === 'undefined') throw new Error(...)`.

// CRITICAL: No React state in the render hot path rule does NOT apply here — this
// component is UI chrome (REC indicator + elapsed time). React state is correct here.

// CRITICAL: Biome v2, pnpm, no 'use client'.
```

---

## Implementation Blueprint

### Data Models

```typescript
// src/ui/useRecorder.ts

export type RecorderState = {
  isRecording: boolean
  elapsedMs: number
  start(canvas: HTMLCanvasElement): void
  stop(): void
  error: Error | null
}

const CODEC_CANDIDATES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
] as const

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder not supported in this browser')
  }
  for (const c of CODEC_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(c)) return c
  }
  throw new Error('No supported webm codec available')
}
```

### Implementation Tasks (ordered by dependency)

```yaml
Task 1: CREATE src/ui/useRecorder.ts
  - IMPLEMENT: |
      export function useRecorder(): RecorderState
  - DETAILS:
      - State: isRecording (bool), elapsedMs (number), error (Error | null)
      - Refs: recorderRef (MediaRecorder | null), chunksRef (Blob[]), startTimeRef (number), tickerRef (number | null), streamRef (MediaStream | null)
      - start(canvas):
          1. try { const mime = pickMimeType() } catch (e) { setError(e); return }
          2. const stream = canvas.captureStream(30)
          3. streamRef.current = stream
          4. const recorder = new MediaRecorder(stream, { mimeType: mime })
          5. recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
          6. recorder.onstop = () => { buildAndDownload(chunksRef.current, recorder.mimeType); cleanupStream() }
          7. recorder.start()   // no timeslice
          8. recorderRef.current = recorder
          9. startTimeRef.current = performance.now()
          10. tickerRef.current = window.setInterval(() => setElapsedMs(performance.now() - startTimeRef.current), 250)
          11. setIsRecording(true)
      - stop():
          1. recorderRef.current?.stop()  // triggers onstop → download
          2. if (tickerRef.current != null) clearInterval(tickerRef.current)
          3. setIsRecording(false)
          4. setElapsedMs(0)
      - buildAndDownload(chunks, mimeType):
          1. const blob = new Blob(chunks, { type: mimeType })
          2. const url = URL.createObjectURL(blob)
          3. const a = document.createElement('a')
          4. a.href = url
          5. a.download = `hand-tracker-fx-${new Date().toISOString().replace(/:/g, '-')}.webm`
          6. document.body.appendChild(a)
          7. a.click()
          8. document.body.removeChild(a)
          9. setTimeout(() => URL.revokeObjectURL(url), 0)
      - cleanupStream(): streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; chunksRef.current = []
      - useEffect cleanup on unmount: if (isRecording) { stop() }; cancel ticker
  - MIRROR: any existing hook file structure in src/ui or src/camera
  - NAMING: camelCase hook, named export
  - GOTCHA: Use refs for recorder/chunks/stream so state changes don't recreate them
  - VALIDATE: pnpm biome check src/ui/useRecorder.ts && pnpm tsc --noEmit

Task 2: CREATE src/ui/RecordButton.tsx
  - IMPLEMENT: |
      type Props = { canvasRef: React.RefObject<HTMLCanvasElement | null> }
      export function RecordButton({ canvasRef }: Props): JSX.Element
  - DETAILS:
      - const { isRecording, elapsedMs, start, stop, error } = useRecorder()
      - onClick: if (!isRecording) { const c = canvasRef.current; if (c) start(c) } else { stop() }
      - Render: button with `data-recording={isRecording}`, "REC" label, mm:ss counter when recording
      - Show error text (small) when error is non-null
  - MIRROR: src/ui/PresetBar.tsx (Task 4.4) layout conventions
  - NAMING: PascalCase
  - GOTCHA: canvasRef.current may be null early in mount; button should gracefully no-op and stay in idle state
  - VALIDATE: pnpm biome check src/ui/RecordButton.tsx && pnpm tsc --noEmit

Task 3: CREATE src/ui/useRecorder.test.ts
  - IMPLEMENT: Vitest suite covering:
      1. pickMimeType returns vp9 when supported
      2. pickMimeType falls back to vp8 when vp9 isTypeSupported = false
      3. pickMimeType falls back to 'video/webm' when both codec-specific types fail
      4. pickMimeType throws when all candidates unsupported
      5. pickMimeType throws when MediaRecorder is undefined
      6. start() calls canvas.captureStream(30) and constructs MediaRecorder with chosen mime
      7. start() then stop(): ondataavailable → onstop path builds a Blob and calls anchor.click()
      8. Filename format matches `hand-tracker-fx-YYYY-MM-DDTHH-MM-SS...webm` (no colons)
      9. Elapsed ticker updates state
      10. Component unmount while recording calls stop()
      11. stop() revokes the object URL after 0ms timeout
  - MOCK: |
      const mockRecorder = {
        start: vi.fn(),
        stop: vi.fn(function(this: any) { this.onstop?.() }),
        ondataavailable: null,
        onstop: null,
        mimeType: 'video/webm;codecs=vp8',
        state: 'inactive',
      }
      vi.stubGlobal('MediaRecorder', class { ... })
      Object.defineProperty(MediaRecorder, 'isTypeSupported', { value: vi.fn(t => t === 'video/webm;codecs=vp8') })
      Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', { value: vi.fn(() => ({ getTracks: () => [{ stop: vi.fn() }] })) })
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake')
      vi.spyOn(URL, 'revokeObjectURL')
  - MIRROR: any existing src/ui/*.test.ts or src/engine/*.test.ts
  - VALIDATE: pnpm vitest run src/ui/useRecorder.test.ts

Task 4: MODIFY src/ui/App.tsx
  - FIND: where Panel / PresetBar are rendered
  - ADD: const topCanvasRef = useRef<HTMLCanvasElement | null>(null)
         pass topCanvasRef to the Canvas2D component (Phase 3)
         render <RecordButton canvasRef={topCanvasRef} />
  - PRESERVE: existing canvas mounting order
  - VALIDATE: pnpm build
```

### Integration Points

```yaml
TOP_CANVAS:
  - App.tsx holds the ref
  - Canvas2D component (Phase 3) assigns the DOM element to it via ref forwarding
  - RecordButton reads canvasRef.current when start is clicked

CSP:
  - vercel.json media-src includes blob: (D31)
  - Vite dev config must allow blob: in media-src too (Phase 1 deliverable)
```

---

## Validation Loop

### Level 1 — Syntax & Style

```bash
pnpm biome check src/ui/useRecorder.ts src/ui/useRecorder.test.ts src/ui/RecordButton.tsx src/ui/App.tsx
pnpm tsc --noEmit
```

### Level 2 — Unit Tests

```bash
pnpm vitest run src/ui/useRecorder.test.ts
pnpm vitest run
```

### Level 3 — Integration

```bash
pnpm build
```

### Level 4 — E2E

```bash
pnpm test:e2e -- --grep "Task 4.5:"
```

Playwright test asserts:
- Click Record → button data-recording="true"
- Wait 2 seconds
- Click Record → Playwright download event fires with filename matching `/hand-tracker-fx-.*\.webm/`
- Downloaded file size > 0

Use `page.on('download', ...)` to capture the download.

---

## Final Validation Checklist

### Technical

- [ ] All 4 levels exit 0
- [ ] `pnpm biome check .` — zero errors
- [ ] `pnpm tsc --noEmit` — zero errors
- [ ] `pnpm vitest run` — all tests pass

### Feature

- [ ] vp9 used when supported, vp8 when not
- [ ] Downloaded .webm plays back the full effect (manual VLC check)
- [ ] REC indicator + elapsed time display correctly
- [ ] Clicking Record during recording stops and downloads
- [ ] Unmount while recording cleans up stream

### Code Quality

- [ ] No `any` types
- [ ] Refs for MediaRecorder, chunks, stream, ticker
- [ ] `URL.revokeObjectURL` deferred via setTimeout(0)
- [ ] `track.stop()` called on stream cleanup

---

## Anti-Patterns

- Do not pass `timeslice` to `recorder.start()` — we want one blob at stop.
- Do not hardcode `'video/webm'` as the final Blob type — use `recorder.mimeType`.
- Do not call `captureStream()` every frame — call once at start.
- Do not forget to stop the stream's tracks — leaking tracks leaks memory.
- Do not use setState inside the render loop for elapsedMs — use a 250ms ticker.
- Do not include `:` in the filename — breaks Windows downloads.
- Do not swallow codec-unsupported errors silently — surface to UI.

---

## No Prior Knowledge Test

- [ ] Every cited file exists (Phase 3 renderer.ts assumed delivered)
- [ ] D-numbers cited (D28, D31, D35) exist in DISCOVERY.md
- [ ] Validation commands copy-paste runnable
- [ ] Codec chain matches D28 (vp9 → vp8)
- [ ] Filename pattern matches D28 (`hand-tracker-fx-{ISO-timestamp}.webm`)
- [ ] No dependency on Tasks 4.1/4.2/4.3/4.4/4.6

---

## Skills to Read Before Starting

```
.claude/skills/prp-task-ralph-loop/SKILL.md
.claude/skills/hand-tracker-fx-architecture/SKILL.md
.claude/skills/vite-vercel-coop-coep/SKILL.md
.claude/skills/vitest-unit-testing-patterns/SKILL.md
.claude/skills/playwright-e2e-webcam/SKILL.md
```
