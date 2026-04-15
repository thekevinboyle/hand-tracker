import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CAMERA_STATES } from '../camera/cameraState';
import { ErrorStates } from './ErrorStates';
import { errorCopy } from './errorCopy';

describe('ErrorStates', () => {
  it('renders null for GRANTED', () => {
    const { container } = render(<ErrorStates state="GRANTED" onRetry={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders null for PROMPT (PrePromptCard owns that state)', () => {
    const { container } = render(<ErrorStates state="PROMPT" onRetry={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  for (const state of CAMERA_STATES) {
    if (state === 'GRANTED' || state === 'PROMPT') continue;
    it(`renders ${state} card with its title`, () => {
      render(<ErrorStates state={state} onRetry={() => {}} />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(errorCopy[state].title)).toBeInTheDocument();
      expect(screen.getByTestId(`error-state-card-${state}`)).toBeInTheDocument();
    });
  }

  it('NO_WEBGL has no retry button (terminal)', () => {
    render(<ErrorStates state="NO_WEBGL" onRetry={() => {}} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('USER_DENIED retry button invokes onRetry', () => {
    const spy = vi.fn();
    render(<ErrorStates state="USER_DENIED" onRetry={spy} />);
    screen.getByRole('button', { name: /retry/i }).click();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
