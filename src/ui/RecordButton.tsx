/**
 * Record button (Task 4.5).
 *
 * Thin React component: one button that toggles `useRecorder.start()` /
 * `stop()` against a caller-supplied canvas getter. Shows a red filled
 * circle + "REC" + mm:ss elapsed while recording; default circle + "REC"
 * label otherwise. Surfaces any recorder error as small caption text.
 *
 * `getCanvas` is a callback — NOT a ref — so App.tsx can resolve the
 * overlay canvas lazily from `stageRef.current?.overlayCanvas` at click
 * time. This avoids the "ref is null on first render" dance the blueprint
 * warns about.
 */

import type { JSX } from 'react';
import { useRecorder } from './useRecorder';

export type RecordButtonProps = {
  /** Resolves the canvas to capture at click time. Return `null` when
   *  the canvas isn't mounted yet; the button silently no-ops. */
  getCanvas: () => HTMLCanvasElement | null;
};

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  top: 12,
  right: 12,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 4,
  zIndex: 10,
};
const buttonBaseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  background: 'rgba(17, 17, 17, 0.85)',
  color: '#e6e6e6',
  border: '1px solid #2d2d2d',
  borderRadius: 20,
  font: '12px/1.2 inherit',
  cursor: 'pointer',
  userSelect: 'none',
};
const buttonRecordingStyle: React.CSSProperties = {
  ...buttonBaseStyle,
  background: 'rgba(200, 40, 40, 0.85)',
  borderColor: '#a02525',
  color: '#fff',
};
const dotStyle: React.CSSProperties = {
  display: 'inline-block',
  width: 10,
  height: 10,
  borderRadius: '50%',
  background: '#d23030',
};
const errorStyle: React.CSSProperties = {
  font: '11px/1.3 inherit',
  color: '#e85050',
  maxWidth: 260,
  textAlign: 'right' as const,
};

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function RecordButton({ getCanvas }: RecordButtonProps): JSX.Element {
  const { isRecording, elapsedMs, error, start, stop } = useRecorder();

  function handleClick(): void {
    if (isRecording) {
      stop();
      return;
    }
    const canvas = getCanvas();
    if (!canvas) return; // canvas not mounted yet — no-op gracefully
    start(canvas);
  }

  return (
    <div style={containerStyle} data-testid="record-button">
      <button
        type="button"
        onClick={handleClick}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        data-recording={isRecording ? 'true' : 'false'}
        style={isRecording ? buttonRecordingStyle : buttonBaseStyle}
      >
        <span style={dotStyle} aria-hidden="true" />
        <span>REC</span>
        {isRecording ? <span data-testid="record-elapsed">{formatElapsed(elapsedMs)}</span> : null}
      </button>
      {error ? (
        <div style={errorStyle} role="alert">
          {error.message}
        </div>
      ) : null}
    </div>
  );
}
