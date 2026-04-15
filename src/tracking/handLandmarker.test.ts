import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isWebGLFailure } from './errors';

const createFromOptionsMock = vi.fn();
const forVisionTasksMock = vi.fn();

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: forVisionTasksMock },
  HandLandmarker: { createFromOptions: createFromOptionsMock },
}));

describe('isWebGLFailure', () => {
  it.each([
    ['Error creating webgl context', true],
    ['emscripten_webgl_create_context failed', true],
    ['kGpuService unavailable', true],
    ['Unable to initialize EGL', true],
    ["Couldn't create GL context", true],
    ['404 Not Found', false],
    ['Failed to fetch', false],
    ['random error', false],
  ])('maps %s -> %s', (msg, expected) => {
    expect(isWebGLFailure(msg as string)).toBe(expected);
  });
});

describe('initHandLandmarker', () => {
  beforeEach(() => {
    vi.resetModules();
    createFromOptionsMock.mockReset();
    forVisionTasksMock.mockReset();
    forVisionTasksMock.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with GPU delegate on the happy path', async () => {
    const fake = { detectForVideo: vi.fn(), close: vi.fn() };
    createFromOptionsMock.mockResolvedValueOnce(fake);
    const { initHandLandmarker, isUsingGpu, disposeHandLandmarker } = await import(
      './handLandmarker'
    );
    const lm = await initHandLandmarker();
    expect(lm).toBe(fake);
    expect(isUsingGpu()).toBe(true);
    expect(forVisionTasksMock).toHaveBeenCalledWith('/wasm');
    expect(createFromOptionsMock).toHaveBeenCalledTimes(1);
    expect(createFromOptionsMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        baseOptions: expect.objectContaining({
          modelAssetPath: '/models/hand_landmarker.task',
          delegate: 'GPU',
        }),
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      }),
    );
    disposeHandLandmarker();
  });

  it('falls back to CPU when GPU init fails non-WebGL', async () => {
    const fake = { detectForVideo: vi.fn(), close: vi.fn() };
    createFromOptionsMock
      .mockRejectedValueOnce(new Error('some other gpu init issue'))
      .mockResolvedValueOnce(fake);
    const { initHandLandmarker, isUsingGpu, disposeHandLandmarker } = await import(
      './handLandmarker'
    );
    const lm = await initHandLandmarker();
    expect(lm).toBe(fake);
    expect(isUsingGpu()).toBe(false);
    expect(createFromOptionsMock).toHaveBeenCalledTimes(2);
    const secondCall = createFromOptionsMock.mock.calls[1];
    expect(secondCall).toBeDefined();
    expect(secondCall?.[1]).toMatchObject({
      baseOptions: expect.objectContaining({ delegate: 'CPU' }),
    });
    disposeHandLandmarker();
  });

  it('throws WebGLUnavailableError on WebGL-flavored GPU failure', async () => {
    createFromOptionsMock.mockRejectedValueOnce(
      new Error('emscripten_webgl_create_context failed'),
    );
    const { initHandLandmarker, disposeHandLandmarker } = await import('./handLandmarker');
    const { WebGLUnavailableError: FreshWebGLError } = await import('./errors');
    await expect(initHandLandmarker()).rejects.toBeInstanceOf(FreshWebGLError);
    // GPU fail recognized as WebGL failure → no CPU retry
    expect(createFromOptionsMock).toHaveBeenCalledTimes(1);
    disposeHandLandmarker();
  });

  it('throws ModelLoadError when GPU (non-webgl) and CPU both fail', async () => {
    createFromOptionsMock
      .mockRejectedValueOnce(new Error('weird gpu init'))
      .mockRejectedValueOnce(new Error('404 model not found'));
    const { initHandLandmarker, disposeHandLandmarker } = await import('./handLandmarker');
    const { ModelLoadError: FreshModelLoadError } = await import('./errors');
    await expect(initHandLandmarker()).rejects.toBeInstanceOf(FreshModelLoadError);
    expect(createFromOptionsMock).toHaveBeenCalledTimes(2);
    disposeHandLandmarker();
  });

  it('shares _initPromise across concurrent callers', async () => {
    const fake = { detectForVideo: vi.fn(), close: vi.fn() };
    createFromOptionsMock.mockResolvedValue(fake);
    const { initHandLandmarker, disposeHandLandmarker } = await import('./handLandmarker');
    const [a, b] = await Promise.all([initHandLandmarker(), initHandLandmarker()]);
    expect(a).toBe(b);
    expect(createFromOptionsMock).toHaveBeenCalledTimes(1);
    disposeHandLandmarker();
  });

  it('returns the cached instance on subsequent calls', async () => {
    const fake = { detectForVideo: vi.fn(), close: vi.fn() };
    createFromOptionsMock.mockResolvedValue(fake);
    const { initHandLandmarker, disposeHandLandmarker } = await import('./handLandmarker');
    const first = await initHandLandmarker();
    const second = await initHandLandmarker();
    expect(second).toBe(first);
    expect(createFromOptionsMock).toHaveBeenCalledTimes(1);
    disposeHandLandmarker();
  });

  it('disposeHandLandmarker swallows close() throws (#5718 freeze bug)', async () => {
    const fake = {
      detectForVideo: vi.fn(),
      close: vi.fn(() => {
        throw new Error('freeze bug');
      }),
    };
    createFromOptionsMock.mockResolvedValue(fake);
    const { initHandLandmarker, disposeHandLandmarker } = await import('./handLandmarker');
    await initHandLandmarker();
    expect(() => disposeHandLandmarker()).not.toThrow();
    expect(fake.close).toHaveBeenCalledTimes(1);
  });

  it('registers window.__handTracker with isReady and isUsingGpu in test mode', async () => {
    const fake = { detectForVideo: vi.fn(), close: vi.fn() };
    createFromOptionsMock.mockResolvedValue(fake);
    const { initHandLandmarker, disposeHandLandmarker } = await import('./handLandmarker');
    const w = window as unknown as {
      __handTracker?: { isReady?: () => boolean; isUsingGpu?: () => boolean };
    };
    expect(w.__handTracker).toBeDefined();
    expect(typeof w.__handTracker?.isReady).toBe('function');
    expect(typeof w.__handTracker?.isUsingGpu).toBe('function');
    expect(w.__handTracker?.isReady?.()).toBe(false);
    await initHandLandmarker();
    expect(w.__handTracker?.isReady?.()).toBe(true);
    expect(w.__handTracker?.isUsingGpu?.()).toBe(true);
    disposeHandLandmarker();
    expect(w.__handTracker?.isReady?.()).toBe(false);
  });
});
