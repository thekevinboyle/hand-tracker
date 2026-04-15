import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import './Stage.css';

export interface StageHandle {
  videoEl: HTMLVideoElement | null;
  webglCanvas: HTMLCanvasElement | null;
  overlayCanvas: HTMLCanvasElement | null;
}

export interface StageProps {
  stream: MediaStream | null;
  mirror?: boolean;
  /**
   * Invoked inside Stage's srcObject effect AFTER `video.play()` resolves (or
   * rejects via the muted-autoplay fallback). App.tsx uses this to own the
   * render-loop lifecycle — renderer ownership does NOT live inside Stage.tsx.
   * See `.claude/skills/hand-tracker-fx-architecture/SKILL.md` §"Stage.tsx
   * evolution" for the final shape after Phase 3 modifications.
   */
  onVideoReady?: (videoEl: HTMLVideoElement) => void;
}

/**
 * Base Stage component (Task 1.6). Composes the visible stage:
 *   - Hidden offscreen <video> element that holds the unmirrored camera pixels
 *     (source of truth for MediaPipe inference per D27).
 *   - Two stacked canvases (WebGL bottom, 2D overlay top) sized full-viewport.
 *   - CSS `scaleX(-1)` applied to display canvases only when mirror is true —
 *     never to the <video> itself (D10 + D27).
 *
 * The wrapper <div> is dual-tagged via a primary `data-testid="stage"` plus a
 * zero-cost overlay child `data-testid="render-canvas"` that occupies the same
 * bounding box, used by Task 2.R and Task 5.4 downstream selectors.
 *
 * Stage does NOT own the render loop. App.tsx consumes `onVideoReady` to start
 * the rVFC-driven loop once the <video> has a live srcObject.
 */
export const Stage = forwardRef<StageHandle, StageProps>(function Stage(
  { stream, mirror = true, onVideoReady },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const webglRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      videoEl: videoRef.current,
      webglCanvas: webglRef.current,
      overlayCanvas: overlayRef.current,
    }),
    [],
  );

  // Assign srcObject when the stream changes. StrictMode double-invokes this
  // effect in dev; assigning the same stream twice is a browser-level no-op,
  // and the cleanup clears srcObject to null to avoid dangling refs.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !stream) {
      return;
    }
    v.srcObject = stream;
    let cancelled = false;
    const notify = () => {
      if (!cancelled) onVideoReady?.(v);
    };
    // jsdom does not implement HTMLMediaElement.play and logs a "Not
    // implemented" error while returning undefined. Guard the result so the
    // test environment doesn't crash on `.then`.
    let playResult: Promise<void> | undefined;
    try {
      playResult = v.play();
    } catch {
      playResult = undefined;
    }
    if (playResult && typeof playResult.then === 'function') {
      void playResult.then(notify).catch(() => {
        // Autoplay rejection path (muted + playsInline usually prevents this,
        // but keep the notification so consumers still wire up the rVFC loop).
        notify();
      });
    } else {
      notify();
    }
    return () => {
      cancelled = true;
      if (v.srcObject === stream) {
        v.srcObject = null;
      }
    };
  }, [stream, onVideoReady]);

  // Canvas backing-store sizing (DPR-aware). CSS size stays 100%.
  useEffect(() => {
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const canvases = [webglRef.current, overlayRef.current];
      for (const c of canvases) {
        if (!c) continue;
        const r = c.getBoundingClientRect();
        c.width = Math.max(1, Math.floor(r.width * dpr));
        c.height = Math.max(1, Math.floor(r.height * dpr));
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <div className="stage" data-mirror={mirror ? 'true' : 'false'} data-testid="stage">
      {/* `render-canvas` alias — zero-cost overlay covering the stage.
          Used by Task 2.R and Task 5.4 via `[data-testid="render-canvas"]`. */}
      <div
        data-testid="render-canvas"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        aria-hidden="true"
      />
      <video
        ref={videoRef}
        className="stage-video"
        playsInline
        muted
        autoPlay
        aria-hidden="true"
        tabIndex={-1}
        data-testid="stage-video"
      >
        <track kind="captions" />
      </video>
      <canvas ref={webglRef} className="stage-canvas stage-webgl" data-testid="webgl-canvas" />
      <canvas
        ref={overlayRef}
        className="stage-canvas stage-overlay"
        data-testid="overlay-canvas"
      />
    </div>
  );
});
