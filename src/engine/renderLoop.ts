import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { updateFpsSample, updateLandmarkCount } from './devHooks';
import type { FrameContext, Landmark } from './types';

export interface StartRenderLoopParams {
  video: HTMLVideoElement;
  landmarker: HandLandmarker;
  onFrame: (ctx: FrameContext) => void;
  /**
   * 2D overlay canvas context — propagated into every per-frame FrameContext.ctx2d.
   * Optional in Phase 1 (pre-Stage.tsx); once Task 1.6 mounts the overlay canvas
   * App.tsx supplies it so downstream effects don't need to early-return.
   */
  overlayCtx2d?: CanvasRenderingContext2D | null;
  onError?: (err: unknown) => void;
}

export interface RenderLoopHandle {
  stop: () => void;
}

const HAVE_CURRENT_DATA = 2;

/**
 * Starts a `requestVideoFrameCallback`-driven render loop. Every decoded video
 * frame:
 *   1. Guard video.readyState >= HAVE_CURRENT_DATA.
 *   2. detectForVideo(video, nowMs) — nowMs from rVFC is monotonic + in the
 *      performance.now() domain, which is exactly what MediaPipe requires.
 *   3. Build FrameContext (D37) and invoke onFrame.
 *   4. Re-register rVFC for the next frame (rVFC is one-shot).
 *
 * Errors thrown by detectForVideo are routed to onError; the loop keeps
 * running so a transient error does not kill rendering. Callers can still
 * call stop() to shut it down.
 */
export function startRenderLoop(params: StartRenderLoopParams): RenderLoopHandle {
  const { video, landmarker, onFrame, overlayCtx2d = null, onError } = params;
  let rvfcId: number | undefined;
  let stopped = false;

  const tick = (nowMs: DOMHighResTimeStamp): void => {
    if (stopped) return;
    try {
      if (video.readyState >= HAVE_CURRENT_DATA) {
        const result = landmarker.detectForVideo(video, nowMs);
        const landmarks: Landmark[] | null = result.landmarks[0] ?? null;
        updateFpsSample(nowMs);
        updateLandmarkCount(landmarks ? landmarks.length : 0);
        const ctx: FrameContext = {
          videoTexture: null,
          videoSize: { w: video.videoWidth, h: video.videoHeight },
          landmarks,
          ctx2d: overlayCtx2d,
          params: {},
          timeMs: nowMs,
        };
        onFrame(ctx);
      }
    } catch (err) {
      onError?.(err);
    }
    if (!stopped) {
      rvfcId = video.requestVideoFrameCallback(tick);
    }
  };

  rvfcId = video.requestVideoFrameCallback(tick);

  return {
    stop() {
      stopped = true;
      if (rvfcId !== undefined) {
        video.cancelVideoFrameCallback(rvfcId);
        rvfcId = undefined;
      }
    },
  };
}
