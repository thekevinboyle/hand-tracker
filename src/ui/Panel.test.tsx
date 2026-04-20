import { cleanup, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EffectInstance, EffectManifest, ParamDef } from '../engine/manifest';
import { paramStore } from '../engine/paramStore';
import { Panel } from './Panel';

function makeManifest(params: ParamDef[] = []): EffectManifest {
  return {
    id: 'panel-test-effect',
    displayName: 'Panel Test',
    version: '0.0.1',
    description: 'Fixture for <Panel />',
    params,
    defaultParams: {},
    modulationSources: [],
    create: (_gl: WebGL2RenderingContext): EffectInstance => ({
      render: () => {},
      dispose: () => {},
    }),
  };
}

describe('<Panel />', () => {
  beforeEach(() => {
    paramStore.replace({});
  });

  afterEach(() => {
    cleanup();
  });

  it('mounts without throwing with an empty manifest', () => {
    expect(() => render(<Panel manifest={makeManifest([])} />)).not.toThrow();
  });

  it('renders a container with data-testid="tweakpane-params-panel"', () => {
    render(<Panel manifest={makeManifest([])} />);
    expect(screen.getByTestId('tweakpane-params-panel')).toBeInTheDocument();
  });

  it('builds the Tweakpane into the container (has children after mount)', () => {
    paramStore.replace({ grid: { columnCount: 12 } });
    render(
      <Panel
        manifest={makeManifest([
          {
            type: 'integer',
            key: 'grid.columnCount',
            label: 'Columns',
            defaultValue: 12,
            min: 4,
            max: 20,
          },
        ])}
      />,
    );
    const container = screen.getByTestId('tweakpane-params-panel');
    expect(container.children.length).toBeGreaterThan(0);
  });

  it('unmount disposes Tweakpane and clears the container', () => {
    paramStore.replace({ grid: { columnCount: 12 } });
    const { unmount } = render(
      <Panel
        manifest={makeManifest([
          {
            type: 'integer',
            key: 'grid.columnCount',
            label: 'Columns',
            defaultValue: 12,
            min: 4,
            max: 20,
          },
        ])}
      />,
    );
    const container = screen.getByTestId('tweakpane-params-panel');
    expect(container.children.length).toBeGreaterThan(0);
    unmount();
    // After unmount the whole tree is gone — we assert by re-querying the
    // detached node: it should have no Tweakpane children left.
    expect(container.children.length).toBe(0);
  });

  it('StrictMode double-mount leaves exactly one live pane (idempotent cleanup)', () => {
    paramStore.replace({ grid: { columnCount: 12 } });
    render(
      <StrictMode>
        <Panel
          manifest={makeManifest([
            {
              type: 'integer',
              key: 'grid.columnCount',
              label: 'Columns',
              defaultValue: 12,
              min: 4,
              max: 20,
            },
          ])}
        />
      </StrictMode>,
    );
    // Tweakpane's root-container-view is `.tp-rotv`. Under StrictMode,
    // useEffect runs, cleans up, then runs again — if our cleanup didn't
    // dispose + clear the host, we'd see two `.tp-rotv` nodes.
    const panel = screen.getByTestId('tweakpane-params-panel');
    expect(panel.querySelectorAll('.tp-rotv').length).toBe(1);
  });
});
