/**
 * src/ui/primitives/LayerCard.test.tsx — unit tests for LayerCard + LayerSection
 * (Task DR-7.6).
 *
 * Coverage (≥ 10):
 *   - A11y wiring: role="region" + aria-labelledby ↔ `<h2>` id
 *   - Title renders as `<h2>` with provided text
 *   - `action` slot renders in the header
 *   - Children render inside the body
 *   - Divider element sits between header and body
 *   - collapsible=false (default) does NOT render chevron
 *   - collapsible renders chevron with aria-expanded="true" initially
 *   - defaultCollapsed starts with aria-expanded="false" + data-collapsed="true"
 *   - Click chevron toggles + fires onCollapsedChange(NEW state)
 *   - aria-hidden reflects collapsed state on the body
 *   - Body `id` aligns with chevron `aria-controls`
 *   - Default testid + override
 *   - forwardRef forwards to the <section> element
 *   - LayerSection renders heading as `<h3>`
 *   - LayerSection withDivider (default true) + withDivider=false
 *
 * Uses fireEvent only (@testing-library/user-event is NOT a project dep).
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LayerCard, LayerSection } from './LayerCard';

afterEach(() => {
  cleanup();
});

describe('Task DR-7.6: LayerCard — a11y + rendering', () => {
  it('renders role="region" with aria-labelledby pointing at the <h2> title id', () => {
    render(
      <LayerCard title="LAYER 1">
        <div>body</div>
      </LayerCard>,
    );
    const region = screen.getByRole('region', { name: /layer 1/i });
    const heading = screen.getByRole('heading', { level: 2, name: /layer 1/i });
    expect(region).toBeInTheDocument();
    expect(heading).toBeInTheDocument();
    // aria-labelledby id must match the <h2>'s id (stable via useId).
    const labelledBy = region.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(heading.id).toBe(labelledBy);
  });

  it('renders title text literally (no transform, no trim)', () => {
    render(
      <LayerCard title="MODULATION">
        <div />
      </LayerCard>,
    );
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toBe('MODULATION');
  });

  it('renders children inside the body region', () => {
    render(
      <LayerCard title="LAYER 1">
        <div data-testid="child-content">hello</div>
      </LayerCard>,
    );
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('renders `action` slot in the header when provided', () => {
    render(
      <LayerCard title="LAYER 1" action={<button type="button">Delete</button>}>
        <div />
      </LayerCard>,
    );
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('renders a divider element (aria-hidden) between header and body', () => {
    const { container } = render(
      <LayerCard title="LAYER 1">
        <div data-testid="body-child">body</div>
      </LayerCard>,
    );
    // `<section>` carries the implicit region landmark role via aria-labelledby.
    const region = container.querySelector('section[aria-labelledby]');
    expect(region).toBeInTheDocument();
    // Order: header, divider, body.
    const children = Array.from(region?.children ?? []);
    expect(children).toHaveLength(3);
    expect(children[0]?.tagName).toBe('HEADER');
    expect(children[1]?.getAttribute('aria-hidden')).toBe('true');
    expect(children[2]?.contains(screen.getByTestId('body-child'))).toBe(true);
  });

  it('defaults data-testid="layer-card" on the root', () => {
    render(
      <LayerCard title="LAYER 1">
        <div />
      </LayerCard>,
    );
    expect(screen.getByTestId('layer-card')).toBeInTheDocument();
  });

  it('honors consumer testid override', () => {
    render(
      <LayerCard title="MODULATION" testid="modulation-card">
        <div />
      </LayerCard>,
    );
    expect(screen.getByTestId('modulation-card')).toBeInTheDocument();
    expect(screen.queryByTestId('layer-card')).toBeNull();
  });

  it('forwards ref to the underlying <section>', () => {
    const ref = createRef<HTMLElement>();
    render(
      <LayerCard ref={ref} title="LAYER 1">
        <div />
      </LayerCard>,
    );
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current?.tagName).toBe('SECTION');
    // `<section>` with an accessible name is implicitly a region landmark,
    // so we don't expect an explicit `role` attribute (Biome flags it).
    expect(ref.current?.getAttribute('aria-labelledby')).toBeTruthy();
  });
});

describe('Task DR-7.6: LayerCard — collapsible behavior', () => {
  it('collapsible=false (default) does NOT render a chevron button', () => {
    render(
      <LayerCard title="LAYER 1">
        <div />
      </LayerCard>,
    );
    expect(screen.queryByTestId('layer-card-chevron')).toBeNull();
  });

  it('collapsible renders a chevron with aria-expanded="true" initially', () => {
    render(
      <LayerCard title="MODULATION" collapsible>
        <div />
      </LayerCard>,
    );
    const chevron = screen.getByTestId('layer-card-chevron');
    expect(chevron).toBeInTheDocument();
    expect(chevron).toHaveAttribute('aria-expanded', 'true');
    expect(chevron).toHaveAttribute('aria-label', 'Collapse MODULATION');
  });

  it('defaultCollapsed starts with aria-expanded="false" + data-collapsed="true" on root + body', () => {
    render(
      <LayerCard title="MODULATION" collapsible defaultCollapsed>
        <div />
      </LayerCard>,
    );
    const chevron = screen.getByTestId('layer-card-chevron');
    const region = screen.getByTestId('layer-card');
    expect(chevron).toHaveAttribute('aria-expanded', 'false');
    expect(chevron).toHaveAttribute('aria-label', 'Expand MODULATION');
    expect(region).toHaveAttribute('data-collapsed', 'true');
  });

  it('clicking the chevron toggles collapsed state + fires onCollapsedChange with the NEW value', () => {
    const onCollapsedChange = vi.fn();
    render(
      <LayerCard title="MODULATION" collapsible onCollapsedChange={onCollapsedChange}>
        <div />
      </LayerCard>,
    );
    const chevron = screen.getByTestId('layer-card-chevron');
    const region = screen.getByTestId('layer-card');

    // Start: expanded (defaultCollapsed=false).
    expect(chevron).toHaveAttribute('aria-expanded', 'true');
    expect(region).toHaveAttribute('data-collapsed', 'false');

    // First click → collapse. Callback receives NEW state (true).
    fireEvent.click(chevron);
    expect(chevron).toHaveAttribute('aria-expanded', 'false');
    expect(region).toHaveAttribute('data-collapsed', 'true');
    expect(onCollapsedChange).toHaveBeenCalledTimes(1);
    expect(onCollapsedChange).toHaveBeenNthCalledWith(1, true);

    // Second click → expand. Callback receives NEW state (false).
    fireEvent.click(chevron);
    expect(chevron).toHaveAttribute('aria-expanded', 'true');
    expect(region).toHaveAttribute('data-collapsed', 'false');
    expect(onCollapsedChange).toHaveBeenCalledTimes(2);
    expect(onCollapsedChange).toHaveBeenNthCalledWith(2, false);
  });

  it('body carries aria-hidden="true" when collapsed and aria-hidden="false" when expanded', () => {
    const { container } = render(
      <LayerCard title="MODULATION" collapsible defaultCollapsed>
        <div data-testid="body-child">body</div>
      </LayerCard>,
    );
    const body = screen.getByTestId('body-child').parentElement;
    expect(body).not.toBeNull();
    expect(body).toHaveAttribute('aria-hidden', 'true');

    // Expand via chevron click.
    fireEvent.click(screen.getByTestId('layer-card-chevron'));
    expect(body).toHaveAttribute('aria-hidden', 'false');

    // Sanity: body is still in the DOM (no display:none — we animate height).
    expect(container.contains(body)).toBe(true);
  });

  it('chevron aria-controls matches the body id (ARIA expansion pattern)', () => {
    render(
      <LayerCard title="MODULATION" collapsible>
        <div data-testid="body-child">body</div>
      </LayerCard>,
    );
    const chevron = screen.getByTestId('layer-card-chevron');
    const body = screen.getByTestId('body-child').parentElement;
    expect(body).not.toBeNull();
    const controls = chevron.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    expect(body?.id).toBe(controls);
  });

  it('chevron is a native <button type="button"> (never submits a form)', () => {
    render(
      <LayerCard title="MODULATION" collapsible>
        <div />
      </LayerCard>,
    );
    const chevron = screen.getByTestId('layer-card-chevron');
    expect(chevron.tagName).toBe('BUTTON');
    expect(chevron).toHaveAttribute('type', 'button');
  });

  it('defaultCollapsed is ignored when collapsible=false (body stays visible)', () => {
    // A non-collapsible card must never hide its body, even if a consumer
    // passes `defaultCollapsed` by mistake.
    render(
      <LayerCard title="LAYER 1" defaultCollapsed>
        <div data-testid="body-child">body</div>
      </LayerCard>,
    );
    const region = screen.getByTestId('layer-card');
    const body = screen.getByTestId('body-child').parentElement;
    expect(region).toHaveAttribute('data-collapsed', 'false');
    expect(body).toHaveAttribute('aria-hidden', 'false');
    expect(screen.queryByTestId('layer-card-chevron')).toBeNull();
  });
});

describe('Task DR-7.6: LayerSection', () => {
  it('renders heading as <h3> when provided', () => {
    render(
      <LayerSection heading="Grid">
        <div data-testid="section-body">body</div>
      </LayerSection>,
    );
    const h3 = screen.getByRole('heading', { level: 3, name: /grid/i });
    expect(h3).toBeInTheDocument();
    expect(screen.getByTestId('section-body')).toBeInTheDocument();
  });

  it('omits the <h3> when no heading is passed', () => {
    render(
      <LayerSection>
        <div>body</div>
      </LayerSection>,
    );
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
  });

  it('defaults data-testid="layer-section" and honors override', () => {
    const { rerender } = render(
      <LayerSection heading="Grid">
        <div />
      </LayerSection>,
    );
    expect(screen.getByTestId('layer-section')).toBeInTheDocument();

    rerender(
      <LayerSection heading="Mosaic" testid="layer-card-mosaic">
        <div />
      </LayerSection>,
    );
    expect(screen.getByTestId('layer-card-mosaic')).toBeInTheDocument();
  });

  it('defaults withDivider=true and reflects it on data-with-divider attr', () => {
    const { rerender } = render(
      <LayerSection heading="Grid">
        <div />
      </LayerSection>,
    );
    expect(screen.getByTestId('layer-section')).toHaveAttribute('data-with-divider', 'true');

    rerender(
      <LayerSection heading="Input" withDivider={false}>
        <div />
      </LayerSection>,
    );
    expect(screen.getByTestId('layer-section')).toHaveAttribute('data-with-divider', 'false');
  });
});
