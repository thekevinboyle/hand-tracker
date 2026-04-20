/**
 * src/ui/LayerRow.test.tsx — unit tests for LayerRow (Task DR-8.2).
 *
 * Coverage:
 *   - Renders the label text literally
 *   - Renders children inside the control slot
 *   - Default testid + override
 *   - Multiple rows stack side-by-side without interfering
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LayerRow } from './LayerRow';

afterEach(() => {
  cleanup();
});

describe('Task DR-8.2: LayerRow — rendering', () => {
  it('renders the label text literally', () => {
    render(
      <LayerRow label="Width variance">
        <span>child</span>
      </LayerRow>,
    );
    expect(screen.getByText('Width variance')).toBeInTheDocument();
  });

  it('renders children inside the control slot', () => {
    render(
      <LayerRow label="Mirror">
        <button type="button" data-testid="inner-control">
          toggle
        </button>
      </LayerRow>,
    );
    expect(screen.getByTestId('inner-control')).toBeInTheDocument();
  });

  it('defaults to data-testid="layer-row"', () => {
    render(
      <LayerRow label="Seed">
        <span>child</span>
      </LayerRow>,
    );
    expect(screen.getByTestId('layer-row')).toBeInTheDocument();
  });

  it('accepts a `testid` override', () => {
    render(
      <LayerRow label="Seed" testid="row-seed">
        <span>child</span>
      </LayerRow>,
    );
    expect(screen.getByTestId('row-seed')).toBeInTheDocument();
  });

  it('renders multiple rows stacked as siblings', () => {
    render(
      <div>
        <LayerRow label="Columns" testid="row-cols">
          <span>A</span>
        </LayerRow>
        <LayerRow label="Rows" testid="row-rows">
          <span>B</span>
        </LayerRow>
      </div>,
    );
    expect(screen.getByTestId('row-cols')).toBeInTheDocument();
    expect(screen.getByTestId('row-rows')).toBeInTheDocument();
    expect(screen.getByText('Columns')).toBeInTheDocument();
    expect(screen.getByText('Rows')).toBeInTheDocument();
  });
});
