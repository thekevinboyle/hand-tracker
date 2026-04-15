import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CameraState } from './camera/cameraState';

const stateRef: { current: CameraState } = { current: 'GRANTED' };

vi.mock('./camera/useCamera', () => ({
  useCamera: () => ({
    state: stateRef.current,
    videoEl: createRef<HTMLVideoElement>(),
    stream: null,
    devices: [],
    retry: () => {},
    setDeviceId: () => {},
  }),
}));

import { App } from './App';

describe('App', () => {
  beforeEach(() => {
    stateRef.current = 'GRANTED';
  });

  it('renders the Stage (video + stacked canvases) when camera is GRANTED', () => {
    stateRef.current = 'GRANTED';
    render(<App />);
    expect(screen.getByTestId('stage')).toBeInTheDocument();
    expect(screen.getByTestId('stage-video')).toBeInTheDocument();
    expect(screen.getByTestId('webgl-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('overlay-canvas')).toBeInTheDocument();
  });

  it('renders the PrePromptCard when camera state is PROMPT', () => {
    stateRef.current = 'PROMPT';
    render(<App />);
    expect(screen.getByTestId('error-state-card-PROMPT')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /enable your camera/i })).toBeInTheDocument();
  });

  it('renders an error card when camera state is USER_DENIED', () => {
    stateRef.current = 'USER_DENIED';
    render(<App />);
    expect(screen.getByTestId('error-state-card-USER_DENIED')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('keeps camera-state testid in the DOM across states', () => {
    stateRef.current = 'DEVICE_CONFLICT';
    render(<App />);
    expect(screen.getByTestId('camera-state')).toHaveTextContent('DEVICE_CONFLICT');
  });
});
