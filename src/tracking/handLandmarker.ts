import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { isWebGLFailure, ModelLoadError, WebGLUnavailableError } from './errors';

export type HandLandmarkerDelegate = 'GPU' | 'CPU';

let _instance: HandLandmarker | null = null;
let _initPromise: Promise<HandLandmarker> | null = null;
let _usingGpu = false;

const WASM_PATH = '/wasm';
const MODEL_PATH = '/models/hand_landmarker.task';

const COMMON_OPTIONS = {
  runningMode: 'VIDEO' as const,
  numHands: 1,
  minHandDetectionConfidence: 0.5,
  minHandPresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
};

export async function initHandLandmarker(): Promise<HandLandmarker> {
  if (_instance) return _instance;
  if (_initPromise) return _initPromise;
  _initPromise = _create();
  try {
    return await _initPromise;
  } finally {
    _initPromise = null;
  }
}

// Alias preserved for skill/docs parity
export const getHandLandmarker = initHandLandmarker;

async function _create(): Promise<HandLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);

  // Attempt GPU first (D17).
  try {
    const lm = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'GPU' },
      ...COMMON_OPTIONS,
    });
    _usingGpu = true;
    _instance = lm;
    console.info('[HandLandmarker] GPU delegate initialized');
    return lm;
  } catch (gpuErr) {
    const msg = gpuErr instanceof Error ? gpuErr.message : String(gpuErr);
    if (isWebGLFailure(msg)) {
      throw new WebGLUnavailableError(msg);
    }
    console.warn('[HandLandmarker] GPU failed, falling back to CPU:', msg);
  }

  // CPU fallback.
  try {
    const lm = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'CPU' },
      ...COMMON_OPTIONS,
    });
    _usingGpu = false;
    _instance = lm;
    console.info('[HandLandmarker] CPU delegate initialized');
    return lm;
  } catch (cpuErr) {
    const msg = cpuErr instanceof Error ? cpuErr.message : String(cpuErr);
    throw new ModelLoadError(msg);
  }
}

export function isUsingGpu(): boolean {
  return _usingGpu;
}

export function disposeHandLandmarker(): void {
  if (_instance) {
    try {
      _instance.close();
    } catch {
      // MediaPipe issue #5718: close() can freeze the page with the GPU
      // delegate active. Swallow so teardown keeps progressing; GC handles
      // the underlying wasm heap when the tab is closed.
    }
    _instance = null;
  }
  _initPromise = null;
  _usingGpu = false;
}

// Dev/test-only hook. Stripped in production by Vite (tree-shaken via
// import.meta.env.DEV === false).
if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
  type HandTrackerHook = {
    isReady: () => boolean;
    isUsingGpu: () => boolean;
  };
  const w = window as unknown as { __handTracker?: Record<string, unknown> };
  const existing = (w.__handTracker ?? {}) as Record<string, unknown>;
  const hook: HandTrackerHook = {
    isReady: () => _instance !== null,
    isUsingGpu,
  };
  w.__handTracker = { ...existing, ...hook };
}
