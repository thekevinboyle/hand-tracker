import { useEffect, useRef, useState } from 'react';
import { useCamera } from './camera/useCamera';
import { startRenderLoop } from './engine/renderLoop';
import { initHandLandmarker } from './tracking/handLandmarker';
import { ErrorStates } from './ui/ErrorStates';
import { PrePromptCard } from './ui/PrePromptCard';
import { Stage, type StageHandle } from './ui/Stage';

export function App() {
  const { state, retry, stream } = useCamera();
  const [trackerError, setTrackerError] = useState<unknown>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const stageRef = useRef<StageHandle | null>(null);

  // Render-loop lifetime is owned here, NOT in Stage.tsx (see
  // hand-tracker-fx-architecture skill). Stage's onVideoReady populates the
  // `videoEl` state once the <video> element has a live srcObject + has
  // resolved `play()` (or rejected — either way we can start rVFC). The
  // effect tears down + restarts cleanly on StrictMode double-mount because
  // startRenderLoop.stop() is idempotent.
  useEffect(() => {
    if (state !== 'GRANTED' || !videoEl) return;

    let cancelled = false;
    let stopLoop: (() => void) | null = null;

    (async () => {
      try {
        const landmarker = await initHandLandmarker();
        if (cancelled) return;
        const overlayCanvas = stageRef.current?.overlayCanvas ?? null;
        const overlayCtx2d = overlayCanvas ? overlayCanvas.getContext('2d') : null;
        const handle = startRenderLoop({
          video: videoEl,
          landmarker,
          overlayCtx2d,
          onFrame: () => {
            /* Phase 2+ wires the effect registry dispatch here. */
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
    };
  }, [state, videoEl]);

  return (
    <main className="app-shell">
      <p data-testid="camera-state" style={{ position: 'absolute', left: -9999 }}>
        {state}
      </p>
      {state === 'PROMPT' && <PrePromptCard onAllow={retry} />}
      {state !== 'PROMPT' && state !== 'GRANTED' && <ErrorStates state={state} onRetry={retry} />}
      {state === 'GRANTED' && (
        <>
          <Stage ref={stageRef} stream={stream} mirror onVideoReady={(el) => setVideoEl(el)} />
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
