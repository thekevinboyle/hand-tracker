/**
 * MediaRecorder hook (Task 4.5).
 *
 * React hook that captures the caller-supplied canvas at 30 fps via
 * `canvas.captureStream(30)` + `MediaRecorder`, and triggers a single
 * blob download on stop(). Codec preference: vp9 → vp8 → plain webm.
 * No audio, no timeslice, no duration cap (D28). All state lives in
 * refs so mid-flight recording isn't torn down by parent re-renders.
 *
 * Recorded surface: the 2D overlay canvas. Task 3.4's effect render()
 * pre-composites the WebGL mosaic onto the overlay BEFORE drawing the
 * grid + blobs + labels, so `captureStream()` on the overlay captures
 * the full composited output (video + mosaic + overlay).
 *
 * Error surfacing: `pickMimeType` throws when the browser can't do any
 * webm codec — the hook stores the Error on `state.error` and leaves
 * `isRecording` false. The UI button reads `error` and renders a
 * small message instead of a mid-recording crash.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderState = {
  isRecording: boolean;
  elapsedMs: number;
  error: Error | null;
  start: (canvas: HTMLCanvasElement) => void;
  stop: () => void;
};

/** Codec preference list — first supported one wins. vp9 is the visual
 *  quality target; vp8 covers older Safari; plain `video/webm` is the
 *  last-resort lossy fallback. If none are supported we surface a
 *  typed error instead of trying to record against nothing. */
const CODEC_CANDIDATES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'] as const;

export function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder not supported in this browser');
  }
  for (const c of CODEC_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  throw new Error('No supported webm codec available');
}

function sanitizeFilenameTimestamp(d: Date): string {
  // ISO with colons swapped for hyphens — Windows filesystems disallow `:`.
  return d.toISOString().replace(/:/g, '-');
}

export function useRecorder(): RecorderState {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const tickerRef = useRef<number | null>(null);

  const cleanupTicker = useCallback((): void => {
    if (tickerRef.current !== null) {
      window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  const cleanupStream = useCallback((): void => {
    streamRef.current?.getTracks().forEach((t) => {
      t.stop();
    });
    streamRef.current = null;
  }, []);

  const buildAndDownload = useCallback((chunks: Blob[], mimeType: string): void => {
    const blob = new Blob(chunks, { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hand-tracker-fx-${sanitizeFilenameTimestamp(new Date())}.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Defer revoke so the browser has already begun streaming the blob
    // (synchronous revoke can cancel the download in some Chromium builds).
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, []);

  const start = useCallback(
    (canvas: HTMLCanvasElement): void => {
      if (isRecording) return;
      let mime: string;
      try {
        mime = pickMimeType();
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        return;
      }
      let stream: MediaStream;
      try {
        stream = canvas.captureStream(30);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        return;
      }
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        buildAndDownload(chunksRef.current, recorder.mimeType || mime);
        chunksRef.current = [];
        cleanupStream();
      };
      recorder.onerror = (ev: Event) => {
        const err = new Error(
          `MediaRecorder error: ${(ev as unknown as { error?: { name?: string } }).error?.name ?? 'unknown'}`,
        );
        setError(err);
      };

      recorder.start(); // no timeslice — single blob at stop()
      recorderRef.current = recorder;
      startTimeRef.current = performance.now();
      setElapsedMs(0);
      setError(null);
      setIsRecording(true);

      // 250 ms ticker for the on-screen mm:ss readout. Not in the render
      // hot path — pure React UI chrome.
      tickerRef.current = window.setInterval(() => {
        setElapsedMs(performance.now() - startTimeRef.current);
      }, 250);
    },
    [isRecording, buildAndDownload, cleanupStream],
  );

  const stop = useCallback((): void => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    try {
      recorder.stop(); // triggers onstop → download
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      cleanupStream();
    }
    cleanupTicker();
    recorderRef.current = null;
    setIsRecording(false);
    setElapsedMs(0);
  }, [cleanupTicker, cleanupStream]);

  // Unmount safety: stop any in-flight recording so ticker + stream don't leak.
  useEffect(() => {
    return () => {
      cleanupTicker();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          // Already stopped — ignore.
        }
      }
      cleanupStream();
    };
  }, [cleanupTicker, cleanupStream]);

  return { isRecording, elapsedMs, error, start, stop };
}
