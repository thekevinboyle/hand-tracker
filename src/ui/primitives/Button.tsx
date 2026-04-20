/*
 * src/ui/primitives/Button.tsx — Button primitive (Task DR-7.1).
 *
 * Four variants (primary / secondary / text / icon) × two sizes (sm / md).
 * Signature pixelcrash square→pill hover via a ::before pseudo-element
 * (see Button.module.css). Reduced-motion honored via the global
 * `prefers-reduced-motion: reduce` override on `--duration-*` tokens in
 * src/ui/tokens.css — no JS listener in this component.
 *
 * Authority:
 *   - DISCOVERY.md DR11 — square→pill hover + reduced-motion.
 *   - `custom-param-components` skill § 3.1 — Button contract.
 *   - `design-tokens-dark-palette` skill — token names.
 *
 * Testid convention: defaults to `button-${variant}`; overridable via the
 * `testid` prop. a11y: native <button>, keyboard accessible, focus-visible
 * outline via --color-focus-ring, `disabled` toggles pointer-events: none
 * and opacity 0.4 (CSS). `aria-label` required for variant='icon' (enforced
 * at the type level via the ButtonProps overloads below? — kept optional
 * here for flexibility; consumer specs still lint-check via axe in DR-7.R).
 */

import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'icon';
export type ButtonSize = 'sm' | 'md';

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** Visual variant. Default: 'secondary'. */
  variant?: ButtonVariant;
  /** Size variant. Default: 'md'. */
  size?: ButtonSize;
  /** Override the default `data-testid` (default: `button-${variant}`). */
  testid?: string;
  children: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(props, ref) {
  const { variant = 'secondary', size = 'md', testid, className, type, children, ...rest } = props;

  // Merge consumer className AFTER internal styles.root so consumer can override.
  const mergedClassName =
    className !== undefined && className.length > 0 ? `${styles.root} ${className}` : styles.root;

  return (
    <button
      {...rest}
      ref={ref}
      // Default to type="button" so a Button inside a <form> never
      // accidentally submits. Consumer can still pass type="submit".
      type={type ?? 'button'}
      className={mergedClassName}
      data-variant={variant}
      data-size={size}
      data-testid={testid ?? `button-${variant}`}
    >
      {children}
    </button>
  );
});
