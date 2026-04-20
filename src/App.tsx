import { useCallback, useEffect, useRef, useState } from 'react';
import type { Pane } from 'tweakpane';
import { useCamera } from './camera/useCamera';
import { handTrackingMosaicManifest } from './effects/handTrackingMosaic';
import type { EffectInstance } from './engine/manifest';
import { applyModulation, resolveModulationSources } from './engine/modulation';
import { modulationStore } from './engine/modulationStore';
import { paramStore } from './engine/paramStore';
import { reducedMotion } from './engine/reducedMotion';
import { uploadVideoFrame } from './engine/renderer';
import { startRenderLoop } from './engine/renderLoop';
import { initHandLandmarker } from './tracking/handLandmarker';
import { ErrorStates } from './ui/ErrorStates';
import { Panel } from './ui/Panel';
import { PrePromptCard } from './ui/PrePromptCard';
import { PresetBar } from './ui/PresetBar';
import { Sidebar } from './ui/Sidebar';
import { Stage, type StageHandle } from './ui/Stage';
import { Toolbar } from './ui/Toolbar';

export function App() {
  const { state, retry, stream } = useCamera();
  const [trackerError, setTrackerError] = useState<unknown>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  // Task 3.5: bumped whenever Stage re-creates the video Texture after a
  // `webglcontextrestored` event. The render-loop effect depends on this
  // so it tears down the current EffectInstance (whose Program's sampler
  // was bound to the now-dead texture) and rebuilds from the fresh one.
  const [textureGen, setTextureGen] = useState(0);
  const handleTextureRecreated = useCallback(() => {
    setTextureGen((g) => g + 1);
  }, []);
  const stageRef = useRef<StageHandle | null>(null);
  // Task 4.4: lifted so <PresetBar /> and <Panel /> share the same
  // Tweakpane instance. Panel populates on mount; PresetBar consumes on
  // each cycle for pane.refresh().
  const paneRef = useRef<Pane | null>(null);

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
            // (D26) — only the hand-driven layer pauses, Tweakpane edits
            // still apply live. The evaluator's identity-fast-path means
            // no-op frames cost one Map construction + one for-loop.
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

  return (
    <main className="app-shell">
      <p data-testid="camera-state" style={{ position: 'absolute', left: -9999 }}>
        {state}
      </p>
      {state === 'PROMPT' && <PrePromptCard onAllow={retry} />}
      {state !== 'PROMPT' && state !== 'GRANTED' && <ErrorStates state={state} onRetry={retry} />}
      {state === 'GRANTED' && (
        <>
          {/* Task DR-8.1: Toolbar replaces the old floating RecordButton.
              Wordmark left + CellSizePicker center + inline Record button
              right. Task 4.5's overlay-canvas capture semantics are
              preserved — the getCanvas callback still returns the 2D
              overlay so captureStream() picks up the pre-composited
              mosaic. */}
          <Toolbar getCanvas={() => stageRef.current?.overlayCanvas ?? null} />
          <Stage
            ref={stageRef}
            stream={stream}
            mirror
            onVideoReady={(el) => setVideoEl(el)}
            onTextureRecreated={handleTextureRecreated}
          />
          {/* Task DR-8.2: new right-column Sidebar hosting LayerCard1
              (all 14 manifest params). Owns the `panel-root` +
              `params-panel` testids going forward. The Tweakpane `<Panel />`
              stays mounted until DR-8.6 retires it — its testids have been
              renamed (`tweakpane-panel-root` / `tweakpane-params-panel`)
              so the new chrome owns the canonical names. */}
          <Sidebar />
          <Panel manifest={handTrackingMosaicManifest} paneRef={paneRef} />
          <PresetBar paneRef={paneRef} />
          {trackerError ? (
            <p data-testid="tracker-error" hidden>
              tracker error
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}
