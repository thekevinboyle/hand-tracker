/*
 * src/ui/primitives/LayerCard.tsx — LayerCard + LayerSection primitives
 * (Task DR-7.6).
 *
 * `<LayerCard>` is the structural container used by the entire reworked
 * sidebar (DR-8.2 LayerCard1, DR-8.3 ModulationCard, DR-8.5 PresetStrip).
 * Renders a panel surface with 20px padding, a header row (title + optional
 * action slot), a 1px hairline divider, and a body.
 *
 * `<LayerSection>` is a grouped inner row — heading (`<h3>`) + children, with
 * an optional bottom hairline divider. Multiple sections stack inside the
 * card's body.
 *
 * Collapsible behavior:
 *   - `collapsible` adds a chevron button to the header (ARIA expand pattern).
 *   - Internal expanded state is seeded from `defaultCollapsed`.
 *   - Body wraps in a div with `data-collapsed="true|false"` driving CSS.
 *   - Staggered exit animation (pixelcrash pattern):
 *       · max-height + gap:  `--duration-medium` (0.35s)
 *       · opacity:           `--duration-long`   (0.5s)
 *       · chevron rotate:    `--duration-short`  (0.2s)
 *   - Uses `max-height: 9999px` → `0` rather than `height: auto` because CSS
 *     cannot transition between `auto` and a numeric value.
 *   - `aria-hidden` on the body reflects collapsed — NOT `display: none`,
 *     which would break the height transition.
 *
 * Prop names (load-bearing contract — synergy-fix CRITICAL-05 + HIGH-03):
 *   - LayerSection: `heading` (NOT `title`), `testid` (lowercase)
 *   - LayerCard: `defaultCollapsed` (NOT `collapsedByDefault`)
 *
 * Reduced-motion: handled at the token level in tokens.css (`--duration-*`
 * collapses to 0s under `prefers-reduced-motion: reduce`) — no per-component
 * media block.
 *
 * Authority:
 *   - task-DR-7-6.md
 *   - `custom-param-components` skill § 3.6 — LayerCard / LayerSection contract
 *   - `design-tokens-dark-palette` skill — token names
 *   - DISCOVERY.md DR5 (palette) + DR11 (motion)
 */

import { forwardRef, type JSX, type ReactNode, useId, useState } from 'react';
import styles from './LayerCard.module.css';

export type LayerCardProps = {
  /** Card heading — rendered verbatim (e.g. `"LAYER 1"`). */
  title: string;
  /** Optional right-anchored slot in the header (e.g. a Delete text button). */
  action?: ReactNode;
  /** Card body — typically one or more `<LayerSection>` children. */
  children: ReactNode;
  /** When true, renders a chevron toggle that collapses the body. */
  collapsible?: boolean;
  /** Initial collapsed state (only meaningful when `collapsible`). */
  defaultCollapsed?: boolean;
  /** Fires with the NEW collapsed state after each toggle. */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Override the default `data-testid` (default: `layer-card`). */
  testid?: string;
};

export type LayerSectionProps = {
  /** Section heading (rendered as `<h3>`). Omit for unlabeled sections. */
  heading?: string;
  /** Section body. */
  children: ReactNode;
  /** Draw a 1px hairline divider below this section. Default: `true`. */
  withDivider?: boolean;
  /** Override the default `data-testid` (default: `layer-section`). */
  testid?: string;
};

export const LayerCard = forwardRef<HTMLElement, LayerCardProps>(
  function LayerCard(props, ref): JSX.Element {
    const {
      title,
      action,
      children,
      collapsible = false,
      defaultCollapsed = false,
      onCollapsedChange,
      testid,
    } = props;
    const rootTestid = testid ?? 'layer-card';
    const titleId = useId();
    const bodyId = `${titleId}-body`;

    // Collapsed state is meaningless unless the card is collapsible; keep it
    // always-false for non-collapsible cards so the body is never hidden.
    const [collapsed, setCollapsed] = useState<boolean>(collapsible ? defaultCollapsed : false);

    const handleToggle = (): void => {
      setCollapsed((prev) => {
        const next = !prev;
        onCollapsedChange?.(next);
        return next;
      });
    };

    return (
      <section
        ref={ref}
        // A `<section>` with an accessible name (via aria-labelledby) is
        // implicitly a region landmark in the ARIA spec, so the explicit
        // `role="region"` is redundant. We rely on the implicit role —
        // `getByRole('region', { name })` still matches.
        aria-labelledby={titleId}
        className={styles.root}
        data-testid={rootTestid}
        data-collapsible={collapsible ? 'true' : 'false'}
        data-collapsed={collapsed ? 'true' : 'false'}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {(action !== undefined || collapsible) && (
            <div className={styles.headerRight}>
              {action}
              {collapsible && (
                <button
                  type="button"
                  className={styles.chevron}
                  aria-expanded={!collapsed}
                  aria-controls={bodyId}
                  aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
                  onClick={handleToggle}
                  data-testid={`${rootTestid}-chevron`}
                  data-collapsed={collapsed ? 'true' : 'false'}
                >
                  <svg
                    className={styles.chevronIcon}
                    viewBox="0 0 10 10"
                    width={10}
                    height={10}
                    aria-hidden="true"
                  >
                    {/* ∨ shape — points down when EXPANDED, rotates -90°
                     * (points right) when COLLAPSED via CSS. */}
                    <path
                      d="M2 4 L5 7 L8 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}
        </header>
        <div className={styles.divider} aria-hidden="true" />
        <div
          id={bodyId}
          className={styles.body}
          aria-hidden={collapsed}
          data-collapsed={collapsed ? 'true' : 'false'}
        >
          {children}
        </div>
      </section>
    );
  },
);

export function LayerSection(props: LayerSectionProps): JSX.Element {
  const { heading, children, withDivider = true, testid } = props;
  const rootTestid = testid ?? 'layer-section';
  return (
    <div
      className={styles.section}
      data-with-divider={withDivider ? 'true' : 'false'}
      data-testid={rootTestid}
    >
      {heading !== undefined && <h3 className={styles.sectionHeading}>{heading}</h3>}
      {children}
    </div>
  );
}
