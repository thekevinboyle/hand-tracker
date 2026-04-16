/**
 * Preset chevron bar + keyboard cycler (Task 4.4).
 *
 * Thin React component that:
 *   - Subscribes to `presetCycler` and re-renders on state change.
 *   - Wraps a window-level keydown listener for ArrowLeft / ArrowRight
 *     with a target-type guard so keys inside Tweakpane <input> /
 *     <textarea> elements pass through untouched (Tweakpane's own
 *     value-arrow keys must keep working, D30).
 *   - Renders `<` + current-name + `>` chevrons; both buttons disabled
 *     when `presets.length <= 1`.
 *
 * Source of truth is the cycler — no preset data in React state. The
 * component's only local state is a `useSyncExternalStore`-shaped
 * mirror so re-renders fire on cycler change.
 */

import type { JSX, RefObject } from 'react';
import { useEffect, useState } from 'react';
import type { Pane } from 'tweakpane';
import { type CyclerState, presetCycler } from './PresetCycler';

export type PresetBarProps = {
  paneRef: RefObject<Pane | null>;
};

const barStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  background: 'rgba(17, 17, 17, 0.85)',
  color: '#e6e6e6',
  border: '1px solid #2d2d2d',
  borderRadius: 20,
  font: '12px/1.2 inherit',
  zIndex: 10,
  pointerEvents: 'auto',
  userSelect: 'none',
};
const chevronStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'inherit',
  border: 'none',
  cursor: 'pointer',
  fontSize: 18,
  lineHeight: 1,
  padding: '0 6px',
};
const chevronDisabledStyle: React.CSSProperties = {
  ...chevronStyle,
  opacity: 0.3,
  cursor: 'not-allowed',
};
const nameStyle: React.CSSProperties = {
  minWidth: 120,
  textAlign: 'center' as const,
  fontWeight: 500,
  letterSpacing: 0.3,
};

export function PresetBar({ paneRef }: PresetBarProps): JSX.Element {
  const [state, setState] = useState<CyclerState>(() => presetCycler.getState());

  // Keep local state in sync with the cycler. StrictMode double-mount
  // re-subscribes; the cleanup ensures only one listener is ever active.
  useEffect(() => {
    return presetCycler.onChange(setState);
  }, []);

  // Global keyboard shortcuts. The guard on text-input targets matters
  // for Tweakpane — its number bindings rely on ArrowLeft/Right for
  // per-digit increments. Caret movement in any user-typed field also
  // stays intact.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const target = e.target;
      if (target instanceof HTMLInputElement) return;
      if (target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        presetCycler.cyclePrev(paneRef.current ?? undefined);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        presetCycler.cycleNext(paneRef.current ?? undefined);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [paneRef]);

  const { presets, currentIndex } = state;
  const disabled = presets.length <= 1;
  const name = presets[currentIndex]?.name ?? '—';

  function handlePrev(): void {
    presetCycler.cyclePrev(paneRef.current ?? undefined);
  }
  function handleNext(): void {
    presetCycler.cycleNext(paneRef.current ?? undefined);
  }

  return (
    <div style={barStyle} role="toolbar" aria-label="Preset cycler" data-testid="preset-bar">
      <button
        type="button"
        onClick={handlePrev}
        disabled={disabled}
        aria-label="Previous preset"
        style={disabled ? chevronDisabledStyle : chevronStyle}
      >
        ‹
      </button>
      <span style={nameStyle} data-testid="preset-name">
        {name}
      </span>
      <button
        type="button"
        onClick={handleNext}
        disabled={disabled}
        aria-label="Next preset"
        style={disabled ? chevronDisabledStyle : chevronStyle}
      >
        ›
      </button>
    </div>
  );
}
