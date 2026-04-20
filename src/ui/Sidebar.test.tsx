/**
 * src/ui/Sidebar.test.tsx — unit tests for Sidebar (Task DR-8.2).
 *
 * Coverage:
 *   - Renders the `panel-root` testid on the root `<aside>`
 *   - LayerCard1 mounts inside
 *   - Renders provided `presetStripSlot` in the header when supplied
 *   - Renders provided `modulationSlot` when supplied
 *   - Omits slot containers when props not supplied (zero extra DOM noise)
 */

import { cleanup, render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// Side-effect: seeds paramStore with DEFAULT_PARAM_STATE + registers manifest.
import '../effects/handTrackingMosaic';
import { DEFAULT_PARAM_STATE } from '../effects/handTrackingMosaic/manifest';
import { modulationStore } from '../engine/modulationStore';
import { paramStore } from '../engine/paramStore';
import { ModulationCard } from './ModulationCard';
import { Sidebar } from './Sidebar';

beforeEach(() => {
  paramStore.replace(DEFAULT_PARAM_STATE as unknown as Record<string, Record<string, unknown>>);
  act(() => {
    modulationStore.replaceRoutes([]);
  });
});

afterEach(() => {
  cleanup();
});

describe('Task DR-8.2: Sidebar — structural rendering', () => {
  it('renders an <aside> with data-testid="panel-root"', () => {
    render(<Sidebar />);
    const root = screen.getByTestId('panel-root');
    expect(root).toBeInTheDocument();
    expect(root.tagName.toLowerCase()).toBe('aside');
  });

  it('mounts LayerCard1 inside (params-panel testid is present)', () => {
    render(<Sidebar />);
    expect(screen.getByTestId('params-panel')).toBeInTheDocument();
  });

  it('renders all three LayerSection testids inside', () => {
    render(<Sidebar />);
    expect(screen.getByTestId('layer-card-grid')).toBeInTheDocument();
    expect(screen.getByTestId('layer-card-mosaic')).toBeInTheDocument();
    expect(screen.getByTestId('layer-card-input')).toBeInTheDocument();
  });
});

describe('Task DR-8.2: Sidebar — slot composition', () => {
  it('renders the presetStripSlot when supplied', () => {
    render(<Sidebar presetStripSlot={<div data-testid="preset-strip-content">presets</div>} />);
    expect(screen.getByTestId('preset-strip-content')).toBeInTheDocument();
  });

  it('renders the modulationSlot when supplied', () => {
    render(<Sidebar modulationSlot={<div data-testid="mod-slot-content">mod</div>} />);
    expect(screen.getByTestId('mod-slot-content')).toBeInTheDocument();
  });

  it('does NOT render the preset header wrapper when no slot is provided', () => {
    render(<Sidebar />);
    // The preset strip wrapper doesn't emit any content when unset — only
    // LayerCard1 should be the direct child of the <aside>.
    const root = screen.getByTestId('panel-root');
    // One direct child: the LayerCard1's <section>.
    expect(root.children.length).toBe(1);
  });
});

describe('Task DR-8.3: Sidebar hosts the ModulationCard via modulationSlot', () => {
  it('renders the ModulationCard with testid modulation-card when passed as slot', () => {
    render(<Sidebar modulationSlot={<ModulationCard />} />);
    expect(screen.getByTestId('modulation-card')).toBeInTheDocument();
    // Card heading is present (even while collapsed).
    expect(screen.getByRole('heading', { level: 2, name: /modulation/i })).toBeInTheDocument();
  });
});
