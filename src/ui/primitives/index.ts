/*
 * src/ui/primitives/index.ts — barrel re-exports for the primitives layer
 * (Phase DR-7). Populated one primitive at a time; downstream composites
 * in Phase DR-8 import from here for tidier paths.
 */

export type { ButtonProps, ButtonSize, ButtonVariant } from './Button';
export { Button } from './Button';
export type { SegmentedOption, SegmentedProps } from './Segmented';
export { Segmented } from './Segmented';
