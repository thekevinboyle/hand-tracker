---
name: webcam-permissions-state-machine
description: Use when implementing or modifying camera access, permission error UI, or the useCamera hook in Hand Tracker FX. 8-state machine, explicit error mapping, StrictMode-safe cleanup, single-source-of-truth landmark coordinates vs mirror display.
---

# Webcam Permissions State Machine

Implementation reference for the `useCamera` hook and the 8-state permission machine + error cards. Authoritative decisions live in `DISCOVERY.md` (D10, D22, D23, D24, D25, D26, D27). If anything in this skill contradicts DISCOVERY.md, DISCOVERY.md wins.

## The 8 States

Exactly these state identifiers. Each has a dedicated full-screen card in `ui/ErrorStates.tsx`.

| State | When entered | Card copy intent | Retry? |
|---|---|---|---|
| `PROMPT` | `permissionStatus.state === 'prompt'` and no `getUserMedia` call made yet | Pre-prompt explanation + Allow button | Allow triggers `getUserMedia` |
| `GRANTED` | `getUserMedia` resolved, stream is live | No card — app renders | n/a |
| `USER_DENIED` | `NotAllowedError` AND `permissionStatus.state === 'denied'` | Browser-specific instructions to unblock in site settings | Retry button re-calls `getUserMedia` (no-op until user unblocks; `permissionStatus.onchange` auto-recovers) |
| `SYSTEM_DENIED` | `NotAllowedError` but permissionStatus is not `'denied'` (OS-level block, Permissions-Policy, insecure context) | "Your OS or browser policy blocked camera access" | Retry |
| `DEVICE_CONFLICT` | `NotReadableError` | "Camera is in use by another app. Close Zoom/FaceTime and retry." | Retry |
| `NOT_FOUND` | `NotFoundError` | "No camera detected." | Retry (after user plugs one in; `devicechange` also auto-retries) |
| `MODEL_LOAD_FAIL` | MediaPipe `HandLandmarker.createFromOptions` rejected for any non-WebGL reason | "Hand tracking failed to load." | Retry |
| `NO_WEBGL` | `getContext('webgl2')` returned null OR MediaPipe init threw a webgl/gl-context error | "This browser or GPU can't run the effect." | None — terminal |

Note: `MODEL_LOAD_FAIL` and `NO_WEBGL` are tracker-side states, but per D23 they share the same full-screen card system as the permission states. See "Composite state" below.

## Error → State Mapping

The only place that maps raw errors to states. Keep this table honest — any new branch gets a dedicated state first, not a silent fallthrough.

```ts
// src/camera/errorMapping.ts
import type { CameraState } from './types'

export function mapGetUserMediaError(
  err: unknown,
  permissionState: PermissionState | 'unknown'
): CameraState {
  if (!(err instanceof DOMException)) return 'SYSTEM_DENIED'
  switch (err.name) {
    case 'NotAllowedError':
      return permissionState === 'denied' ? 'USER_DENIED' : 'SYSTEM_DENIED'
    case 'NotFoundError':
    case 'DevicesNotFoundError': // legacy Firefox alias
      return 'NOT_FOUND'
    case 'NotReadableError':
    case 'TrackStartError': // legacy Chrome alias
      return 'DEVICE_CONFLICT'
    // OverconstrainedError is handled BEFORE reaching this function
    // (see startCapture — it retries with relaxed constraints).
    default:
      return 'SYSTEM_DENIED'
  }
}

export function mapTrackerInitError(err: unknown): 'NO_WEBGL' | 'MODEL_LOAD_FAIL' {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
  if (msg.includes('webgl') || msg.includes('gl context') || msg.includes('getcontext')) {
    return 'NO_WEBGL'
  }
  return 'MODEL_LOAD_FAIL'
}
```

`OverconstrainedError` never reaches the mapper. It is handled inside `startCapture` by logging and retrying with `{ video: true }`.

## getUserMedia Constraints (D22)

Always `ideal`, never `exact` for resolution/framerate. The only `exact` allowed is `deviceId`, and only when we have a persisted value that matches a currently-present device.

```ts
// src/camera/constraints.ts
export function buildConstraints(deviceId?: string): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      width:  { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30, min: 15 },
    },
  }
}
```

## Pre-Prompt Card (D23)

Do not call `getUserMedia` on mount. The `PROMPT` state renders a card explaining why the camera is needed. A user click on "Allow" invokes the actual `getUserMedia` call. If `navigator.permissions.query({ name: 'camera' })` returns `granted`, skip the card and call `getUserMedia` immediately.

```ts
async function initialState(): Promise<CameraState> {
  try {
    const status = await navigator.permissions.query({ name: 'camera' as PermissionName })
    if (status.state === 'granted') return 'GRANTED' // caller will immediately start capture
    if (status.state === 'denied')  return 'USER_DENIED'
    return 'PROMPT'
  } catch {
    // Firefox <135 does not support 'camera' permission query — treat as PROMPT
    return 'PROMPT'
  }
}
```

## Device Persistence (D24)

Chosen `deviceId` is stored in `localStorage` under `hand-tracker-fx:cameraDeviceId`. On load, re-validate against live `enumerateDevices()`; if the saved id is not present, drop it and fall back to browser default.

```ts
const LS_KEY = 'hand-tracker-fx:cameraDeviceId'

async function resolveDeviceId(): Promise<string | undefined> {
  const saved = localStorage.getItem(LS_KEY) ?? undefined
  if (!saved) return undefined
  // enumerateDevices requires prior permission grant for labels, but ids are returned regardless
  const devices = await navigator.mediaDevices.enumerateDevices()
  const match = devices.find((d) => d.kind === 'videoinput' && d.deviceId === saved)
  if (!match) {
    localStorage.removeItem(LS_KEY)
    return undefined
  }
  return saved
}
```

## Live Change Listeners

Two listeners feed the machine at runtime:

1. `navigator.mediaDevices.addEventListener('devicechange', ...)` — re-enumerate; if the active track's device disappeared, stop the track and transition back to `GRANTED` on a fresh default device (or `NOT_FOUND` if none remain).
2. `permissionStatus.addEventListener('change', ...)` — if state flips to `granted` while we're in `USER_DENIED`, auto-retry capture. If it flips to `denied`, stop the track and transition to `USER_DENIED`.

Both listeners must be detached in the hook's cleanup.

## Cleanup (D25) — StrictMode-safe

Every mount that opens a track MUST release it. React 19 + StrictMode double-invokes effects in dev; use a ref guard so the second invocation does not open a duplicate track.

- Call `track.stop()` on every track of the stream on unmount.
- Clear any `requestVideoFrameCallback` id via `videoEl.cancelVideoFrameCallback(id)`.
- Clear any `requestAnimationFrame` id via `cancelAnimationFrame(id)`.
- Idempotent cleanup — calling it twice must be a no-op.

```ts
const streamRef = useRef<MediaStream | null>(null)
const openingRef = useRef(false) // ref-guard against StrictMode double-open

async function open() {
  if (streamRef.current || openingRef.current) return
  openingRef.current = true
  try {
    const s = await navigator.mediaDevices.getUserMedia(buildConstraints(deviceId))
    streamRef.current = s
    // If StrictMode already tore down while we were awaiting, stop immediately
    if (!mountedRef.current) {
      s.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      return
    }
    // attach to video element...
  } finally {
    openingRef.current = false
  }
}

function close() {
  const s = streamRef.current
  if (!s) return
  s.getTracks().forEach((t) => t.stop())
  streamRef.current = null
}
```

## Mirror Mode (D10, D27) — Single Source of Truth

- The raw `<video>` element is the **unmirrored** source. MediaPipe receives unmirrored frames. Landmark coordinates are in unmirrored space — that is the single source of truth for all coordinate math.
- CSS `transform: scaleX(-1)` is applied **only** to the displayed canvases/`<video>`. The overlay canvas (blobs + labels) inherits the transform from the wrapper, so screen-space drawing uses the same coordinates as the video pixels and looks correct mirrored for the user.
- Never mirror pixels on the inference path. Never apply `1 - x` correction in landmark logic.
- For recording (D28), since `canvas.captureStream()` does not pick up CSS transforms, either record the top composited canvas that already has the CSS transform baked via a dedicated offscreen compose step, or apply `ctx.scale(-1, 1)` at record time — pick one and document it in the record module.

## Reduced Motion (D26)

On `prefers-reduced-motion: reduce`:
- Pause modulation evaluation — params snap to their neutral (base) values.
- Continue rendering video + grid + blobs.
- Listen for runtime changes on the media query.

```ts
const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
const [reduced, setReduced] = useState(mq.matches)
useEffect(() => {
  const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}, [])
```

The `useCamera` hook itself does not consume this — it is consumed by the modulation evaluator. Noted here for cross-file context.

## Safari iOS Quirks

- `<video>` element MUST have `playsInline` and `muted` attributes, else iOS opens fullscreen. JSX: `<video playsInline muted autoPlay ref={videoRef} />`.
- Safari periodically re-prompts for camera permission even when previously granted. `NotAllowedError` on iOS does not always mean "user denied" — always expose a Retry button.
- Some older WebKit versions mutate `deviceId` on page refresh. On load, if a saved `deviceId` does not match any live device, silently discard it (see `resolveDeviceId`).

## `useCamera` Hook Skeleton

```ts
// src/camera/useCamera.ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { buildConstraints } from './constraints'
import { mapGetUserMediaError } from './errorMapping'

export type CameraState =
  | 'PROMPT'
  | 'GRANTED'
  | 'USER_DENIED'
  | 'SYSTEM_DENIED'
  | 'DEVICE_CONFLICT'
  | 'NOT_FOUND'
  | 'MODEL_LOAD_FAIL'
  | 'NO_WEBGL'

export interface UseCameraResult {
  state: CameraState
  videoEl: React.RefObject<HTMLVideoElement>
  stream: MediaStream | null
  devices: MediaDeviceInfo[]
  retry: () => void
  setDeviceId: (id: string) => void
}

const LS_KEY = 'hand-tracker-fx:cameraDeviceId'

export function useCamera(): UseCameraResult {
  const [state, setState] = useState<CameraState>('PROMPT')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceIdState] = useState<string | undefined>(
    () => localStorage.getItem(LS_KEY) ?? undefined
  )

  const videoEl = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const openingRef = useRef(false)
  const mountedRef = useRef(true)
  const permStatusRef = useRef<PermissionStatus | null>(null)

  const closeStream = useCallback(() => {
    const s = streamRef.current
    if (!s) return
    s.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const startCapture = useCallback(async () => {
    if (streamRef.current || openingRef.current) return
    openingRef.current = true
    try {
      let s: MediaStream
      try {
        s = await navigator.mediaDevices.getUserMedia(buildConstraints(deviceId))
      } catch (e) {
        if (e instanceof DOMException && e.name === 'OverconstrainedError') {
          console.warn('[useCamera] OverconstrainedError, retrying w/o constraints', e)
          s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        } else {
          throw e
        }
      }
      if (!mountedRef.current) {
        s.getTracks().forEach((t) => t.stop())
        return
      }
      streamRef.current = s
      if (videoEl.current) {
        videoEl.current.srcObject = s
        await videoEl.current.play().catch(() => { /* autoplay policy; user gesture already happened */ })
      }
      // Refresh device list now that we have permission (labels become readable)
      const all = await navigator.mediaDevices.enumerateDevices()
      setDevices(all.filter((d) => d.kind === 'videoinput'))
      // Track auto-end (unplug, OS revoke)
      s.getVideoTracks()[0]?.addEventListener('ended', () => {
        closeStream()
        setState('NOT_FOUND')
      })
      setState('GRANTED')
    } catch (err) {
      const permState = permStatusRef.current?.state ?? 'unknown'
      setState(mapGetUserMediaError(err, permState))
    } finally {
      openingRef.current = false
    }
  }, [deviceId, closeStream])

  const retry = useCallback(() => {
    closeStream()
    setState('PROMPT')
    void startCapture()
  }, [closeStream, startCapture])

  const setDeviceId = useCallback((id: string) => {
    localStorage.setItem(LS_KEY, id)
    setDeviceIdState(id)
    closeStream()
    void startCapture()
  }, [closeStream, startCapture])

  // Mount: resolve initial permission state, attach listeners
  useEffect(() => {
    mountedRef.current = true
    let cancelled = false

    ;(async () => {
      try {
        const status = await navigator.permissions.query({ name: 'camera' as PermissionName })
        if (cancelled) return
        permStatusRef.current = status
        status.addEventListener('change', () => {
          if (status.state === 'granted' && !streamRef.current) void startCapture()
          if (status.state === 'denied') {
            closeStream()
            setState('USER_DENIED')
          }
        })
        if (status.state === 'granted') void startCapture()
        else if (status.state === 'denied') setState('USER_DENIED')
        else setState('PROMPT')
      } catch {
        setState('PROMPT')
      }
    })()

    const onDeviceChange = async () => {
      const all = await navigator.mediaDevices.enumerateDevices()
      const videoInputs = all.filter((d) => d.kind === 'videoinput')
      setDevices(videoInputs)
      if (videoInputs.length === 0) {
        closeStream()
        setState('NOT_FOUND')
      }
    }
    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange)

    return () => {
      cancelled = true
      mountedRef.current = false
      navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange)
      closeStream()
    }
  }, [startCapture, closeStream])

  return { state, videoEl, stream: streamRef.current, devices, retry, setDeviceId }
}
```

The `PROMPT`→`GRANTED` transition from a user click is initiated by the `ErrorStates` component calling `retry()` (or a dedicated `allow()` if you split them). The hook itself never auto-prompts — only `permissionStatus === 'granted'` on load auto-starts.

## Composite State: worst-of(cameraState, trackerState)

The app-level state combines camera and tracker into one card:

```ts
// src/app/appState.ts
type TrackerState = 'INIT' | 'READY' | 'MODEL_LOAD_FAIL' | 'NO_WEBGL'

const severity: Record<CameraState | TrackerState, number> = {
  NO_WEBGL: 100,
  MODEL_LOAD_FAIL: 90,
  USER_DENIED: 80,
  SYSTEM_DENIED: 75,
  DEVICE_CONFLICT: 70,
  NOT_FOUND: 65,
  PROMPT: 30,
  INIT: 20,
  GRANTED: 10,
  READY: 0,
}

export function composite(cam: CameraState, trk: TrackerState): CameraState | TrackerState {
  return severity[cam] >= severity[trk] ? cam : trk
}
```

`ErrorStates.tsx` switches on the composite. `GRANTED + READY` collapses to "render the app" — no card.

## MediaPipe Init Integration

`HandLandmarker.createFromOptions` is called from a separate `useHandLandmarker()` hook. Wrap it in try/catch and run the error through `mapTrackerInitError`. The resulting state feeds the composite.

```ts
try {
  const vision = await FilesetResolver.forVisionTasks('/wasm')
  landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: '/models/hand_landmarker.task', delegate: 'GPU' },
    runningMode: 'VIDEO',
    numHands: 1,
  })
  setTrackerState('READY')
} catch (err) {
  console.error('[tracker] init failed', err)
  setTrackerState(mapTrackerInitError(err))
}
```

A preflight `detectWebGL()` before tracker init lets you short-circuit to `NO_WEBGL` without a confusing MediaPipe stack trace.

## Testing — Mocking `getUserMedia` in Vitest

```ts
// src/camera/useCamera.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCamera } from './useCamera'

function mockStream(): MediaStream {
  const track = {
    kind: 'video',
    stop: vi.fn(),
    addEventListener: vi.fn(),
  } as unknown as MediaStreamTrack
  return {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as unknown as MediaStream
}

beforeEach(() => {
  // Default: prompt state, no devices
  vi.stubGlobal('navigator', {
    permissions: {
      query: vi.fn().mockResolvedValue({
        state: 'prompt',
        addEventListener: vi.fn(),
      }),
    },
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue(mockStream()),
      enumerateDevices: vi.fn().mockResolvedValue([
        { kind: 'videoinput', deviceId: 'cam-a', label: 'Front' },
      ]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  })
})

describe('useCamera', () => {
  it('starts in PROMPT when permission is prompt', async () => {
    const { result } = renderHook(() => useCamera())
    await waitFor(() => expect(result.current.state).toBe('PROMPT'))
  })

  it('transitions to USER_DENIED on NotAllowedError when permission is denied', async () => {
    ;(navigator.permissions.query as ReturnType<typeof vi.fn>).mockResolvedValue({
      state: 'denied', addEventListener: vi.fn(),
    })
    ;(navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(
      new DOMException('denied', 'NotAllowedError')
    )
    const { result } = renderHook(() => useCamera())
    await waitFor(() => expect(result.current.state).toBe('USER_DENIED'))
  })

  it('maps NotReadableError to DEVICE_CONFLICT', async () => {
    ;(navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(
      new DOMException('busy', 'NotReadableError')
    )
    const { result } = renderHook(() => useCamera())
    act(() => { result.current.retry() })
    await waitFor(() => expect(result.current.state).toBe('DEVICE_CONFLICT'))
  })

  it('retries with relaxed constraints on OverconstrainedError', async () => {
    const gum = navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>
    gum.mockRejectedValueOnce(new DOMException('bad', 'OverconstrainedError'))
       .mockResolvedValueOnce(mockStream())
    const { result } = renderHook(() => useCamera())
    act(() => { result.current.retry() })
    await waitFor(() => expect(result.current.state).toBe('GRANTED'))
    expect(gum).toHaveBeenCalledTimes(2)
    expect(gum.mock.calls[1][0]).toEqual({ video: true, audio: false })
  })
})
```

Playwright E2E uses Chrome's `--use-fake-device-for-media-stream` flag so the browser auto-grants a synthetic camera — the hook will reach `GRANTED` without a real webcam.

## Anti-Patterns

- Calling `getUserMedia` on component mount (skips pre-prompt, per D23).
- Mirroring pixels for the inference path (breaks D27's single source of truth).
- Using `exact` for width/height/frameRate (causes `OverconstrainedError` on Firefox and many webcams, per D22).
- Forgetting `track.stop()` in cleanup (camera indicator stays on, mic-style device-in-use conflicts).
- Letting StrictMode open two tracks in dev by not using a ref-guard (`openingRef`).
- Silently swallowing unknown error names as `GRANTED` — always route unknowns to `SYSTEM_DENIED`.
- Omitting `playsInline muted` on the `<video>` (breaks iOS Safari).
- Reading `permissionStatus.state` synchronously without feature-detection (Firefox < 135 throws on `{ name: 'camera' }`).
