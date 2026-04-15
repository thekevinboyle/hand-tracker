import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { Stage, type StageHandle } from './Stage';

describe('Stage', () => {
  it('renders a hidden video and two canvases', () => {
    render(<Stage stream={null} />);
    const video = screen.getByTestId('stage-video') as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video.getAttribute('aria-hidden')).toBe('true');
    // React normalises `playsInline` to the lowercased DOM attribute.
    expect(video.hasAttribute('playsinline')).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.autoplay).toBe(true);
    expect(screen.getByTestId('webgl-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('overlay-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('render-canvas')).toBeInTheDocument();
  });

  it('exposes refs via the imperative handle', () => {
    const ref = createRef<StageHandle>();
    render(<Stage stream={null} ref={ref} />);
    expect(ref.current?.videoEl).toBeInstanceOf(HTMLVideoElement);
    expect(ref.current?.webglCanvas).toBeInstanceOf(HTMLCanvasElement);
    expect(ref.current?.overlayCanvas).toBeInstanceOf(HTMLCanvasElement);
  });

  it('sets data-mirror="true" by default', () => {
    render(<Stage stream={null} />);
    expect(screen.getByTestId('stage').getAttribute('data-mirror')).toBe('true');
  });

  it('sets data-mirror="false" when mirror={false}', () => {
    render(<Stage stream={null} mirror={false} />);
    expect(screen.getByTestId('stage').getAttribute('data-mirror')).toBe('false');
  });

  it('does NOT apply scaleX(-1) to the <video> element itself (D27)', () => {
    // Mirror source-of-truth invariant — inline style transform never set on the video.
    render(<Stage stream={null} mirror />);
    const video = screen.getByTestId('stage-video') as HTMLVideoElement;
    expect(video.style.transform).toBe('');
  });

  it('assigns srcObject when a stream is provided', () => {
    const fake = { getTracks: () => [] } as unknown as MediaStream;
    render(<Stage stream={fake} />);
    const video = screen.getByTestId('stage-video') as HTMLVideoElement;
    expect(video.srcObject).toBe(fake);
  });
});
