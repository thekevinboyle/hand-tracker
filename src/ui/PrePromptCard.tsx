import { useEffect, useRef } from 'react';
import './cards.css';
import { errorCopy } from './errorCopy';

interface Props {
  onAllow: () => void;
}

export function PrePromptCard({ onAllow }: Props) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    btnRef.current?.focus();
  }, []);
  const copy = errorCopy.PROMPT;
  return (
    <div
      className="card"
      role="dialog"
      aria-live="polite"
      aria-labelledby="prp-title"
      data-testid="error-state-card-PROMPT"
    >
      <h2 id="prp-title" className="card-title">
        {copy.title}
      </h2>
      <p className="card-body">{copy.body}</p>
      <button ref={btnRef} className="card-retry" type="button" onClick={onAllow}>
        {copy.retryLabel ?? 'Enable Camera'}
      </button>
    </div>
  );
}
