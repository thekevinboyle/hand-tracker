import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CameraState } from './camera/cameraState';
import { useCamera } from './camera/useCamera';
import { handTrackingMosaicManifest } from './effects/handTrackingMosaic';
import type { EffectInstance } from './engine/manifest';
import { applyModulation, resolveModulationSources } from './engine/modulation';
import { modulationStore } from './engine/modulationStore';
import { paramStore } from './engine/paramStore';
import { reducedMotion } from './engine/reducedMotion';
import { uploadVideoFrame } from './engine/renderer';
import { startRenderLoop } from './engine/renderLoop';
import { ModelLoadError, WebGLUnavailableError } from './tracking/errors';
import { initHandLandmarker } from './tracking/handLandmarker';
import { ErrorStates } from './ui/ErrorStates';
import { Footer } from './ui/Footer';
import { ModulationCard } from './ui/ModulationCard';
import { PrePromptCard } from './ui/PrePromptCard';
import { PresetStrip } from './ui/PresetStrip';
import { Sidebar } from './ui/Sidebar';
import { Stage, type StageHandle } from './ui/Stage';
import { Toolbar } from './ui/Toolbar';

/**
 * Preflight WebGL2 probe (D23 NO_WEBGL terminal state — DR-9.2). Runs once at
 * App mount against a detached <canvas>: if the browser cannot provide a
 * WebGL2 context (e.g. `--disable-webgl` flag, policy block, getContext
 * stub returning null), short-circuit to NO_WEBGL before Stage tries to
 * create its Renderer. This surfaces the error on the dedicated card
 * instead of crashing the useEffect in Stage.tsx. Also see
 * `src/tracking/handLandmarker.ts` — MediaPipe init surfaces WebGL failures
 * via `WebGLUnavailableError` which we classify in the tracker-init catch.
 */
function probeWebGL2(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    return gl !== null && typeof gl === 'object';
  } catch {
    return false;
  }
}

export function App() {
  const { state, retry, stream } = useCamera();
  const [trackerError, setTrackerError] = useState<unknown>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  // DR-9.2: preflight WebGL2 probe. Memo is stable across re-renders so
  // the effective-state computation doesn't flap.
  const webgl2Available = useMemo(() => probeWebGL2(), []);
  // Task 3.5: bumped whenever Stage re-creates the video Texture after a
  // `webglcontextrestored` event. The render-loop effect depends on this
  // so it tears down the current EffectInstance (whose Program's sampler
  // was bound to the now-dead texture) and rebuilds from the fresh one.
  const [textureGen, setTextureGen] = useState(0);
  const handleTextureRecreated = useCallback(() => {
    setTextureGen((g) => g + 1);
  }, []);
  const stageRef = useRef<StageHandle | null>(null);

  // Render-loop lifetime is owned here, NOT in Stage.tsx (see
  // hand-tracker-fx-architecture skill). Stage's onVideoReady populates the
  // `videoEl` state once the <video> element has a live srcObject + has
  // resolved `play()` (or rejected — either way we can start rVFC). The
  // effect tears down + restarts cleanly on StrictMode double-mount because
  // startRenderLoop.stop() is idempotent.
  //
  // `textureGen` is the Task 3.5 retrigger — bumping it is the only way to
  // force re-mount after Stage re-creates the video Texture on
  // `webglcontextrestored`. The value isn't read inside the effect body;
  // the dependency is load-bearing, not accidental.
  // biome-ignore lint/correctness/useExhaustiveDependencies: textureGen is a re-run-on-change signal
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

        // Create the effect instance. The WebGL canvas provides the GL context;
        // the manifest's create() uses it for gl.clear in the Phase 2 stub and
        // Phase 3 will use it for the mosaic shader. Falls back to null if
        // webgl2 is unavailable (the create() noop handles this gracefully).
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
            // Task 3.1: upload the current video frame into the ogl texture
            // and thread the raw WebGLTexture handle into FrameContext so
            // Phase 3.4's effect render() can sample it. `uploadVideoFrame`
            // is readyState-guarded; a `false` return just means "skip
            // texture rebind this tick" — the effect render still runs with
            // whatever handle is currently valid, and Phase 3's shader
            // tolerates a `null` videoTexture (clear-only fallback).
            const tex = stageRef.current?.getVideoTexture() ?? null;
            if (tex && videoEl) {
              uploadVideoFrame(tex, videoEl);
            }

            // Task 4.1 + 4.6: per-frame modulation pass. Reduced-motion
            // users see the current authored param values held stable
            // (D26) — only the hand-driven layer pauses, direct param
            // edits from the sidebar still apply live.
            if (!reducedMotion.getIsReduced()) {
              const sources = resolveModulationSources(ctx.landmarks);
              const routes = modulationStore.getSnapshot().routes;
              const next = applyModulation(routes, sources, paramStore.snapshot);
              if (next !== paramStore.snapshot) paramStore.replace(next);
            }

            const frame = tex ? { ...ctx, videoTexture: tex.texture } : ctx;
            effectInstance?.render(frame);
          },
          onError: (err) => {
            console.error('[App] detectForVideo error', err);
          },
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
      if (effectInstance) {
        effectInstance.dispose();
        effectInstance = null;
      }
    };
  }, [state, videoEl, textureGen]);

  // DR-9.2: classify tracker-init failures into D23 states. A
  // `WebGLUnavailableError` from MediaPipe's GPU init or ogl's Renderer is
  // terminal → NO_WEBGL. A `ModelLoadError` (model fetch/parse failure or
  // both GPU+CPU failing for non-webgl reasons) → MODEL_LOAD_FAIL.
  // `webgl2Available === false` covers the preflight case where WebGL2 is
  // unavailable before the tracker even runs (e.g. `--disable-webgl`).
  const effectiveState: CameraState = !webgl2Available
    ? 'NO_WEBGL'
    : trackerError instanceof WebGLUnavailableError
      ? 'NO_WEBGL'
      : trackerError instanceof ModelLoadError
        ? 'MODEL_LOAD_FAIL'
        : state;

  return (
    <main className="app-shell">
      <p data-testid="camera-state" style={{ position: 'absolute', left: -9999 }}>
        {effectiveState}
      </p>
      {effectiveState === 'PROMPT' && <PrePromptCard onAllow={retry} />}
      {effectiveState !== 'PROMPT' && effectiveState !== 'GRANTED' && (
        <ErrorStates state={effectiveState} onRetry={retry} />
      )}
      {effectiveState === 'GRANTED' && (
        // Task DR-8.6: new flex composition.
        //   .app-layout → column (Toolbar stacks above the body row).
        //   .app-body   → row (Stage grows to fill, Sidebar is fixed-width).
        // Stage moved off `position: fixed` (see Stage.css) so it flexes
        // inside the row. Toolbar + Sidebar also dropped their fixed
        // positioning — everything now flows inside this layout.
        <div className="app-layout">
          {/* Toolbar: wordmark left, CellSizePicker center, Record right.
              Task 4.5's overlay-canvas capture semantics are preserved —
              the getCanvas callback still returns the 2D overlay so
              captureStream() picks up the pre-composited mosaic. */}
          <Toolbar getCanvas={() => stageRef.current?.overlayCanvas ?? null} />
          <div className="app-body">
            <Stage
              ref={stageRef}
              stream={stream}
              mirror
              onVideoReady={(el) => setVideoEl(el)}
              onTextureRecreated={handleTextureRecreated}
            />
            <Sidebar presetStripSlot={<PresetStrip />} modulationSlot={<ModulationCard />} />
          </div>
          {/* Task DR-8.7: Footer renders as row 3 of .app-layout, directly
              below .app-body. It is scoped to the `state === 'GRANTED'`
              branch, so every error-state / PROMPT render omits it
              entirely — matches DR18 "hidden on error/pre-prompt screens"
              without any conditional `hidden` attribute plumbing. */}
          <Footer />
          {trackerError ? (
            <p data-testid="tracker-error" hidden>
              tracker error
            </p>
          ) : null}
        </div>
      )}
    </main>
  );
}
