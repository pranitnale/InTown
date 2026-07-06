import type { CSSProperties, HTMLAttributes } from 'react';
import { cn } from './utils.ts';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: number | string;
  height?: number | string;
  /** Render as a circle (e.g. avatar placeholder). */
  circle?: boolean;
}

/**
 * Loading placeholder with a left→right shimmer (see `.ds-shimmer` in
 * index.css). Under `prefers-reduced-motion: reduce` the shimmer animation and
 * gradient are dropped, leaving a static neutral block.
 */
export function Skeleton({ width, height, circle, className, style, ...rest }: SkeletonProps) {
  const dims: CSSProperties = {
    width,
    height: height ?? (circle ? width : undefined),
    ...style,
  };
  return (
    <div
      aria-hidden
      className={cn('ds-shimmer bg-border', circle ? 'rounded-full' : 'rounded-md', className)}
      style={dims}
      {...rest}
    />
  );
}
