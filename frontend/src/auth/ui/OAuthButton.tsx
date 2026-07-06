// SHIM: replace with @intown design-system primitives at P01 merge
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface OAuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Provider glyph (decorative). */
  icon?: ReactNode;
  children: ReactNode;
}

const CLASSES =
  'inline-flex w-full items-center justify-center gap-3 rounded-lg border border-border ' +
  'bg-surface px-4 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-bg ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

export function OAuthButton({ icon, children, className, type, ...rest }: OAuthButtonProps) {
  return (
    <button
      type={type ?? 'button'}
      className={`${CLASSES}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {icon ? (
        <span aria-hidden="true" className="text-base leading-none">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </button>
  );
}
