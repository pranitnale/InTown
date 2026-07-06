// SHIM: replace with @intown design-system primitives at P01 merge
import type { ReactNode } from 'react';

export type BannerTone = 'info' | 'error';

export interface BannerProps {
  tone?: BannerTone;
  /** Decorative leading glyph (aria-hidden). */
  icon?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
}

/**
 * Non-modal inline notice. `error` uses the error color family + an icon
 * (never terracotta, per §17). `info` is a neutral surface note.
 */
export function Banner({ tone = 'info', icon, title, children }: BannerProps) {
  const isError = tone === 'error';
  const glyph = icon ?? (isError ? '⚠' : 'ℹ');
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={
        'flex items-start gap-3 rounded-lg border p-3 text-sm ' +
        (isError ? 'border-error bg-surface' : 'border-border bg-surface')
      }
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 leading-none ${isError ? 'text-error-large' : 'text-text-secondary'}`}
      >
        {glyph}
      </span>
      <div className="flex flex-col gap-0.5">
        {title ? (
          <p className={`font-semibold ${isError ? 'text-error' : 'text-text'}`}>{title}</p>
        ) : null}
        {children ? <div className="text-text-secondary">{children}</div> : null}
      </div>
    </div>
  );
}
