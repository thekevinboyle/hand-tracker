import type { HandLandmarker } from '@mediapipe/tasks-vision';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetDevHookState, getFPS, getLandmarkCount } from './devHooks';
import { startRenderLoop } from './renderLoop';

type RvfcCallback = (now: number, meta: Record<string, unknown>) => void;

interface FakeVideo extends HTMLVideoElement {
  _tick: (ms: number) => void;
}

function fakeVideo(): FakeVideo {
  const callbacks: RvfcCallback[] = [];
  let nextId = 1;
  const state = {
    readyState: 4,
    videoWidth: 640,
    videoHeight: 480,
    requestVideoFrameCallback: vi.fn((cb: RvfcCallback) => {
      callbacks.push(cb);
      return nextId++;
    }),
    cancelVideoFrameCallback: vi.fn(),
    _tick(ms: number) {
      const cb = callbacks.shift();
      if (cb) cb(ms, {});
    },
  };
  return state as unknown as FakeVideo;
}

function fakeLandmarker(
  result: { landmarks: Array<Array<{ x: number; y: number; z: number }>> } = {
    landmarks: [[{ x: 0, y: 0, z: 0 }]],
  },
): HandLandmarker {
  return { detectForVideo: vi.fn().mockReturnValue(result) } as unknown as HandLandmarker;
}

describe('startRenderLoop', () => {
  beforeEach(() => {
    __resetDevHookState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invokes onFrame each tick with monotonic timeMs and videoSize + empty params', () => {
    const video = fakeVideo();
    const lm = fakeLandmarker();
    const frames: number[] = [];
    const handle = startRenderLoop({
      video,
      landmarker: lm,
      onFrame: (ctx) => {
        expect(ctx.videoTexture).toBeNull();
        expect(ctx.videoSize).toEqual({ w: 640, h: 480 });
        expect(ctx.params).toEqual({});
        frames.push(ctx.timeMs);
      },
    });
    video._tick(100);
    video._tick(200);
    video._tick(300);
    handle.stop();
    expect(frames).toEqual([100, 200, 300]);
    expect(lm.detectForVideo).toHaveBeenCalledTimes(3);
  });

  it('stop() cancels the pending rVFC id idempotently', () => {
    const video = fakeVideo();
    const lm = fakeLandmarker();
    const handle = startRenderLoop({
      video,
      landmarker: lm,
      onFrame: () => {},
    });
    handle.stop();
    handle.stop();
    expect(video.cancelVideoFrameCallback).toHaveBeenCalledTimes(1);
  });

  it('skips detectForVideo when readyState < HAVE_CURRENT_DATA', () => {
    const video = fakeVideo();
    (video as unknown as { readyState: number }).readyState = 1;
    const lm = fakeLandmarker();
    const frames: number[] = [];
    const handle = startRenderLoop({
      video,
      landmarker: lm,
      onFrame: (ctx) => frames.push(ctx.timeMs),
    });
    video._tick(100);
    expect(frames).toEqual([]);
    expect(lm.detectForVideo).not.toHaveBeenCalled();
    handle.stop();
  });

  it('routes detectForVideo errors to onError and keeps looping', () => {
    const video = fakeVideo();
    const lm = {
      detectForVideo: vi.fn().mockImplementation(() => {
        throw new Error('boom');
      }),
    } as unknown as HandLandmarker;
    const errs: unknown[] = [];
    const handle = startRenderLoop({
      video,
      landmarker: lm,
      onFrame: () => {},
      onError: (e) => errs.push(e),
    });
    video._tick(100);
    video._tick(200);
    expect(errs).toHaveLength(2);
    handle.stop();
  });

  it('passes nowMs monotonically to detectForVideo', () => {
    const video = fakeVideo();
    const lm = fakeLandmarker();
    const handle = startRenderLoop({
      video,
      landmarker: lm,
      onFrame: () => {},
    });
    video._tick(100);
    video._tick(200);
    expect(lm.detectForVideo).toHaveBeenNthCalledWith(1, video, 100);
    expect(lm.detectForVideo).toHaveBeenNthCalledWith(2, video, 200);
    handle.stop();
  });

  it('propagates overlayCtx2d into FrameContext.ctx2d when supplied', () => {
    const video = fakeVideo();
    const lm = fakeLandmarker();
    const fakeCtx = {} as CanvasRenderingContext2D;
    let seen: CanvasRenderingContext2D | null = null;
    const handle = startRenderLoop({
      video,
      landmarker: lm,
      overlayCtx2d: fakeCtx,
      onFrame: (ctx) => {
        seen = ctx.ctx2d;
      },
    });
    video._tick(100);
    expect(seen).toBe(fakeCtx);
    handle.stop();
  });

  it('updates dev-hook FPS + landmark count across ticks', () => {
    const video = fakeVideo();
    const lm = fakeLandmarker({
      landmarks: [Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }))],
    });
    const handle = startRenderLoop({
      video,
      landmarker: lm,
      onFrame: () => {},
    });
    video._tick(100);
    video._tick(1100);
    expect(getLandmarkCount()).toBe(21);
    // 2 samples across 1000ms → 1 fps.
    expect(getFPS()).toBeCloseTo(1, 5);
    handle.stop();
  });

  it('reports zero landmarks when detection yields no hand', () => {
    const video = fakeVideo();
    const lm = fakeLandmarker({ landmarks: [] });
    let frameLandmarks: unknown = 'unset';
    const handle = startRenderLoop({
      video,
      landmarker: lm,
      onFrame: (ctx) => {
        frameLandmarks = ctx.landmarks;
      },
    });
    video._tick(100);
    expect(frameLandmarks).toBeNull();
    expect(getLandmarkCount()).toBe(0);
    handle.stop();
  });
});
