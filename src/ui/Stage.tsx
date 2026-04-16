import type { Renderer, Texture } from 'ogl';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { createOglRenderer, createVideoTexture, resizeRenderer } from '../engine/renderer';
import { setRenderer } from '../engine/rendererRef';
import { setVideoTexture } from '../engine/videoTextureRef';
import './Stage.css';

export interface StageHandle {
  videoEl: HTMLVideoElement | null;
  webglCanvas: HTMLCanvasElement | null;
  overlayCanvas: HTMLCanvasElement | null;
  /** Lazy getters — refs are populated by Stage's renderer useEffect AFTER
   *  useImperativeHandle runs, so a direct-value exposure would be stale.
   *  Callers invoke these in their own effects / rVFC callbacks. */
  getRenderer: () => Renderer | null;
  getVideoTexture: () => Texture | null;
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
  const rendererRef = useRef<Renderer | null>(null);
  const textureRef = useRef<Texture | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      videoEl: videoRef.current,
      webglCanvas: webglRef.current,
      overlayCanvas: overlayRef.current,
      getRenderer: () => rendererRef.current,
      getVideoTexture: () => textureRef.current,
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

  // Overlay canvas backing-store sizing (DPR-aware). CSS size stays 100%.
  // The WebGL canvas is sized by the renderer effect below — `renderer.setSize`
  // owns `canvas.width` / `canvas.height` there, so this loop touches only the
  // 2D overlay to avoid two conflicting owners.
  useEffect(() => {
    const resize = () => {
      const c = overlayRef.current;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      const r = c.getBoundingClientRect();
      c.width = Math.max(1, Math.floor(r.width * dpr));
      c.height = Math.max(1, Math.floor(r.height * dpr));
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // ogl Renderer + video Texture lifecycle (Task 3.1). Created on mount,
  // torn down idempotently on unmount — StrictMode's dev double-invoke runs
  // the cleanup between the two mount passes, so `gl.deleteTexture` +
  // `WEBGL_lose_context` run exactly once per mount/unmount cycle.
  //
  // The renderer owns `webglRef.current.width` / `.height` via `setSize`
  // (ResizeObserver picks up both DOM CSS changes and devicePixelRatio
  // moves). The raw `texture.texture` WebGLTexture handle is also published
  // to the engine's `videoTextureRef` broker so devHooks + the Phase 3
  // effect render() can read it without prop-drilling.
  useEffect(() => {
    const canvas = webglRef.current;
    if (!canvas) return;

    const bundle = createOglRenderer(canvas);
    const texture = createVideoTexture(bundle.gl);
    rendererRef.current = bundle.renderer;
    textureRef.current = texture;
    setVideoTexture(texture);
    setRenderer(bundle.renderer);

    const doResize = () => resizeRenderer(bundle.renderer, canvas);
    doResize();
    window.addEventListener('resize', doResize);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
      observer = new ResizeObserver(doResize);
      observer.observe(canvas.parentElement);
    }

    return () => {
      window.removeEventListener('resize', doResize);
      observer?.disconnect();
      // ogl Texture has no destroy(); delete via raw gl handle.
      bundle.gl.deleteTexture(texture.texture);
      // Release the GPU context so a remount can allocate a fresh one.
      const loseExt = bundle.gl.getExtension('WEBGL_lose_context');
      loseExt?.loseContext();
      setVideoTexture(null);
      setRenderer(null);
      rendererRef.current = null;
      textureRef.current = null;
    };
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
