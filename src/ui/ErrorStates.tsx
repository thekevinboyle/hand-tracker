import { useEffect, useRef } from 'react';
import type { CameraState } from '../camera/cameraState';
import './cards.css';
import { errorCopy } from './errorCopy';

interface Props {
  state: CameraState;
  onRetry: () => void;
}

export function ErrorStates({ state, onRetry }: Props) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    // Focus the primary action whenever the rendered card state changes.
    if (state === 'GRANTED' || state === 'PROMPT') return;
    btnRef.current?.focus();
  }, [state]);
  if (state === 'GRANTED' || state === 'PROMPT') return null;
  const copy = errorCopy[state];
  return (
    <div
      className="card"
      role="alert"
      aria-live="polite"
      aria-labelledby="err-title"
      data-testid={`error-state-card-${state}`}
    >
      <h2 id="err-title" className="card-title">
        {copy.title}
      </h2>
      <p className="card-body">{copy.body}</p>
      {copy.retryLabel && (
        <button ref={btnRef} className="card-retry" type="button" onClick={onRetry}>
          {copy.retryLabel}
        </button>
      )}
    </div>
  );
}
