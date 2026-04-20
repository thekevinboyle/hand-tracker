import type { Renderer, Texture } from 'ogl';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  attachContextLossHandlers,
  createOglRenderer,
  createVideoTexture,
  disposeRenderer,
  resizeRenderer,
} from '../engine/renderer';
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
  /**
   * Fired whenever Stage creates a new video `Texture`. The initial mount
   * emits once; a `webglcontextrestored` event triggers a second emit after
   * Stage re-creates the texture against the recovered context. Callers
   * (App.tsx) use this to dispose + rebuild any `EffectInstance` whose
   * Program bound the previous texture reference — ogl's uniform cache is
   * reference-identity, so the old program sampler stays pointed at a dead
   * GL handle until the effect is re-constructed.
   */
  onTextureRecreated?: () => void;
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
  { stream, mirror = true, onVideoReady, onTextureRecreated },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const webglRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const textureRef = useRef<Texture | null>(null);
  // Keep the prop in a ref so the renderer useEffect's deps can stay `[]` —
  // otherwise a parent re-render that hands us a different `onTextureRecreated`
  // callback identity would tear down + recreate the whole WebGL bundle.
  const onTextureRecreatedRef = useRef(onTextureRecreated);
  onTextureRecreatedRef.current = onTextureRecreated;

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

  // ogl Renderer + video Texture lifecycle (Task 3.1 + Task 3.5).
  //
  // Task 3.1 rules still apply: the Renderer is created on mount, torn down
  // idempotently on unmount, and owns `canvas.width/height` via `setSize`.
  // Task 3.5 adds context-loss recovery — if the GPU resets (driver sleep,
  // tab backgrounding, explicit `loseContext()`), the canvas keeps its
  // WebGL2 context reference but every Texture / Program / Buffer against
  // it becomes invalid. The recovery path:
  //
  //   1. `webglcontextlost` → cancel the texture (it's dead anyway), null
  //      the broker refs so any effect.render() mid-flight bails out, keep
  //      the Renderer reference (ogl re-uses the same gl on restore).
  //   2. `webglcontextrestored` → allocate a fresh Texture via
  //      `createVideoTexture(bundle.gl)`, publish through the broker, and
  //      fire `onTextureRecreated` so App.tsx tears down + rebuilds the
  //      EffectInstance whose Program bound the dead texture.
  //
  // The effect is idempotent under StrictMode double-mount because
  // `disposeRenderer` tolerates null handles and detach functions.
  useEffect(() => {
    const canvas = webglRef.current;
    if (!canvas) return;

    const bundle = createOglRenderer(canvas);
    rendererRef.current = bundle.renderer;
    setRenderer(bundle.renderer);

    function mountTexture(): void {
      const texture = createVideoTexture(bundle.gl);
      textureRef.current = texture;
      setVideoTexture(texture);
    }
    function unmountTexture(): void {
      const t = textureRef.current;
      if (t) {
        // deleteTexture tolerates post-loss dead handles silently.
        bundle.gl.deleteTexture(t.texture);
        textureRef.current = null;
      }
      setVideoTexture(null);
    }

    mountTexture();

    const doResize = () => resizeRenderer(bundle.renderer, canvas);
    doResize();
    window.addEventListener('resize', doResize);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
      observer = new ResizeObserver(doResize);
      observer.observe(canvas.parentElement);
    }

    const detachCtxLoss = attachContextLossHandlers(canvas, {
      onLost: () => {
        console.warn('[hand-tracker-fx] WebGL context lost');
        unmountTexture();
      },
      onRestored: () => {
        console.info('[hand-tracker-fx] WebGL context restored — reinitializing');
        mountTexture();
        onTextureRecreatedRef.current?.();
      },
    });

    return () => {
      window.removeEventListener('resize', doResize);
      disposeRenderer({
        renderer: bundle.renderer,
        texture: textureRef.current,
        resizeObserver: observer,
        detachCtxLoss,
        // Do NOT force-lose the context on unmount. Under React StrictMode
        // dev double-mount, the same canvas element is reused by the second
        // mount — forcing loseContext() here hands the second mount a dead
        // WebGL2 context, and ogl's Renderer constructor then silently
        // produces a Renderer whose setSize() cannot push dimensions through
        // (canvas.width stays at the HTML 300 default). The browser GCs the
        // context on its own when the canvas truly detaches.
        forceLoseContext: false,
      });
      setVideoTexture(null);
      setRenderer(null);
      rendererRef.current = null;
      textureRef.current = null;
    };
    // Deps MUST stay empty — see the onTextureRecreatedRef pattern above. A
    // parent re-render that swaps the callback identity must NOT tear down
    // the live WebGL bundle; that path is owned by context-loss + unmount.
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
