import { useCallback, useEffect, useRef, useState } from 'react';
import { type CameraState, isCameraState } from './cameraState';
import { mapGetUserMediaError } from './mapError';

export interface UseCameraResult {
  state: CameraState;
  videoEl: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  devices: MediaDeviceInfo[];
  retry: () => void;
  setDeviceId: (id: string) => void;
}

const LS_KEY = 'hand-tracker-fx:cameraDeviceId';

/**
 * D22 constraints — always `ideal`, never `exact` for width/height/frameRate.
 * The only `exact` allowed is a persisted `deviceId` (D24).
 */
function buildConstraints(deviceId?: string): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30, min: 15 },
    },
  };
}

function readPersistedDeviceId(): string | undefined {
  try {
    return localStorage.getItem(LS_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function writePersistedDeviceId(id: string): void {
  try {
    localStorage.setItem(LS_KEY, id);
  } catch {
    /* storage unavailable — continue without persistence */
  }
}

function clearPersistedDeviceId(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* storage unavailable — no-op */
  }
}

/**
 * DEV/test-only URL-param short-circuit. Returns a forced CameraState if the
 * current URL has `?forceState=<STATE>` AND the current build is DEV or test
 * mode. Returns null in production or when the param is absent/invalid. This
 * is a prerequisite for Phase 5 Task 5.4's 8-error-state E2E suite.
 */
function readForcedState(): CameraState | null {
  if (!(import.meta.env.DEV || import.meta.env.MODE === 'test')) return null;
  if (typeof window === 'undefined') return null;
  try {
    const raw = new URLSearchParams(window.location.search).get('forceState');
    if (raw && isCameraState(raw)) return raw;
  } catch {
    /* no-op — fall through */
  }
  return null;
}

export function useCamera(): UseCameraResult {
  const [state, setState] = useState<CameraState>('PROMPT');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceIdState] = useState<string | undefined>(() => readPersistedDeviceId());

  const videoEl = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const openingRef = useRef(false);
  const mountedRef = useRef(true);
  const permStatusRef = useRef<PermissionStatus | null>(null);
  const forcedRef = useRef<CameraState | null>(null);
  const deviceIdRef = useRef<string | undefined>(deviceId);

  // Keep deviceIdRef in sync so stable callbacks can read the latest value.
  useEffect(() => {
    deviceIdRef.current = deviceId;
  }, [deviceId]);

  const closeStream = useCallback(() => {
    const s = streamRef.current;
    if (!s) return;
    for (const t of s.getTracks()) t.stop();
    streamRef.current = null;
  }, []);

  const startCapture = useCallback(async () => {
    if (forcedRef.current) return;
    if (streamRef.current || openingRef.current) return;
    openingRef.current = true;
    try {
      let s: MediaStream;
      try {
        s = await navigator.mediaDevices.getUserMedia(buildConstraints(deviceIdRef.current));
      } catch (e) {
        if (e instanceof DOMException && e.name === 'OverconstrainedError') {
          console.warn('[useCamera] OverconstrainedError — retrying with relaxed constraints', e);
          s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } else {
          throw e;
        }
      }
      if (!mountedRef.current) {
        for (const t of s.getTracks()) t.stop();
        return;
      }
      streamRef.current = s;
      if (videoEl.current) {
        videoEl.current.srcObject = s;
        try {
          await videoEl.current.play();
        } catch {
          /* autoplay policy — prior user gesture usually already satisfies this */
        }
      }
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        if (mountedRef.current) {
          setDevices(all.filter((d) => d.kind === 'videoinput'));
        }
      } catch {
        /* enumerateDevices can throw on edge cases; ignore */
      }
      const firstTrack = s.getVideoTracks()[0];
      if (firstTrack) {
        firstTrack.addEventListener('ended', () => {
          closeStream();
          if (mountedRef.current) setState('NOT_FOUND');
        });
      }
      if (mountedRef.current) setState('GRANTED');
    } catch (err) {
      const permState: PermissionState | 'unknown' = permStatusRef.current?.state ?? 'unknown';
      const mapped = mapGetUserMediaError(err, permState);
      if (mountedRef.current) setState(mapped);
    } finally {
      openingRef.current = false;
    }
  }, [closeStream]);

  const retry = useCallback(() => {
    if (forcedRef.current) return;
    closeStream();
    setState('PROMPT');
    void startCapture();
  }, [closeStream, startCapture]);

  const setDeviceId = useCallback(
    (id: string) => {
      if (forcedRef.current) return;
      writePersistedDeviceId(id);
      deviceIdRef.current = id;
      setDeviceIdState(id);
      closeStream();
      void startCapture();
    },
    [closeStream, startCapture],
  );

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    // DEV/test URL-param short-circuit
    const forced = readForcedState();
    if (forced) {
      forcedRef.current = forced;
      setState(forced);
      return () => {
        mountedRef.current = false;
        forcedRef.current = null;
      };
    }

    const mediaDevices = navigator.mediaDevices as MediaDevices | undefined;

    const onDeviceChange = async () => {
      if (!mediaDevices) return;
      try {
        const all = await mediaDevices.enumerateDevices();
        if (!mountedRef.current) return;
        const videoInputs = all.filter((d) => d.kind === 'videoinput');
        setDevices(videoInputs);
        const persisted = readPersistedDeviceId();
        if (persisted && !videoInputs.some((d) => d.deviceId === persisted)) {
          clearPersistedDeviceId();
          deviceIdRef.current = undefined;
          setDeviceIdState(undefined);
        }
        if (videoInputs.length === 0) {
          closeStream();
          setState('NOT_FOUND');
        }
      } catch {
        /* ignore */
      }
    };

    let permChangeHandler: (() => void) | null = null;
    let trackedStatus: PermissionStatus | null = null;

    (async () => {
      try {
        const status = await navigator.permissions.query({
          name: 'camera' as PermissionName,
        });
        if (cancelled) return;
        permStatusRef.current = status;
        trackedStatus = status;
        permChangeHandler = () => {
          if (!mountedRef.current) return;
          if (status.state === 'granted' && !streamRef.current) {
            void startCapture();
          } else if (status.state === 'denied') {
            closeStream();
            setState('USER_DENIED');
          }
        };
        status.addEventListener('change', permChangeHandler);
        if (status.state === 'granted') {
          void startCapture();
        } else if (status.state === 'denied') {
          setState('USER_DENIED');
        } else {
          setState('PROMPT');
        }
      } catch {
        // Safari + older Firefox throw on { name: 'camera' } — fall through to PROMPT.
        if (!cancelled && mountedRef.current) setState('PROMPT');
      }
    })();

    if (mediaDevices && typeof mediaDevices.addEventListener === 'function') {
      mediaDevices.addEventListener('devicechange', onDeviceChange);
    }

    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (mediaDevices && typeof mediaDevices.removeEventListener === 'function') {
        mediaDevices.removeEventListener('devicechange', onDeviceChange);
      }
      if (trackedStatus && permChangeHandler) {
        trackedStatus.removeEventListener('change', permChangeHandler);
      }
      closeStream();
    };
  }, [startCapture, closeStream]);

  return {
    state,
    videoEl,
    stream: streamRef.current,
    devices,
    retry,
    setDeviceId,
  };
}

export { CAMERA_STATES, type CameraState, isCameraState } from './cameraState';
export { mapGetUserMediaError } from './mapError';
