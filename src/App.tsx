import { useEffect, useState } from 'react';
import { useCamera } from './camera/useCamera';
import { startRenderLoop } from './engine/renderLoop';
import { initHandLandmarker } from './tracking/handLandmarker';
import { ErrorStates } from './ui/ErrorStates';
import { PrePromptCard } from './ui/PrePromptCard';

export function App() {
  const { state, retry, videoEl } = useCamera();
  const [trackerError, setTrackerError] = useState<unknown>(null);

  // Render-loop lifetime is owned here, NOT in Stage.tsx (see
  // hand-tracker-fx-architecture skill). Effect runs when state flips to
  // GRANTED; cleanup cancels the rVFC registration. Idempotent under
  // StrictMode because startRenderLoop returns a handle with an idempotent
  // stop(). We do NOT call disposeHandLandmarker on unmount — the module-
  // level singleton survives across StrictMode double-mount.
  useEffect(() => {
    if (state !== 'GRANTED') return;
    const video = videoEl.current;
    if (!video) return;

    let cancelled = false;
    let stopLoop: (() => void) | null = null;

    (async () => {
      try {
        const landmarker = await initHandLandmarker();
        if (cancelled) return;
        const handle = startRenderLoop({
          video,
          landmarker,
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
          <h1>Hand Tracker FX</h1>
          <p>Scaffolding ready. Webcam pipeline lands in Phase 1 of the implementation plan.</p>
          {trackerError ? (
            <p data-testid="tracker-error" hidden>
              tracker error
            </p>
          ) : null}
        </>
      )}
      {/*
        Hidden <video> owned by useCamera — rendered at all times so
        `videoEl.current` is non-null when useCamera's startCapture sets
        srcObject (startCapture fires before state transitions to GRANTED).
        Task 1.6 replaces this with the Stage component.
      */}
      <video
        ref={videoEl}
        playsInline
        muted
        autoPlay
        style={{ display: 'none' }}
        data-testid="hidden-video"
      >
        <track kind="captions" />
      </video>
    </main>
  );
}
