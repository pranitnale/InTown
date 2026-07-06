import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn, FOCUS_RING } from './utils.ts';
import { IconAlertTriangle } from './icons.tsx';

/**
 * Color doctrine enforced in the defaults (§17):
 *   - `primary`      → blue fill = FUNCTION (the default CTA).
 *   - `secondary`    → neutral outline on surface.
 *   - `ghost`        → text-only, transparent.
 *   - `destructive`  → error family (#B91C1C in light) + an ALWAYS-present icon.
 *                      Rendered as an outline/soft treatment so it is safe in
 *                      BOTH themes: light has no `bg-error`+white body pair for
 *                      dark, so we never fill error with white text. `error`
 *                      text on `bg` is a tested pair in both modes.
 *   - `emotion`      → terracotta, peaks ONLY. Uses `terracotta-fill`+`on-terracotta`
 *                      (the tested filled pair in both light and dark). Never the
 *                      default — pass it deliberately.
 * Amber/warning is never a button fill (would force dark-text-only handling and
 * reads as a status, not an action).
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'emotion';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-on-primary hover:brightness-110 active:bg-primary-pressed active:text-on-primary-pressed',
  secondary: 'bg-surface text-text border border-border hover:bg-bg active:bg-bg',
  ghost: 'bg-transparent text-text hover:bg-surface active:bg-surface',
  destructive:
    'bg-transparent text-error border border-error hover:bg-error/10 active:bg-error/20',
  emotion: 'bg-terracotta-fill text-on-terracotta hover:brightness-110 active:brightness-95',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'text-sm px-3 py-1.5 gap-1.5 rounded-md',
  md: 'text-base px-4 py-2 gap-2 rounded-lg',
  lg: 'text-lg px-5 py-2.5 gap-2 rounded-lg',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon rendered before the label. Required-by-doctrine for `destructive`. */
  leftIcon?: ReactNode;
  /** Icon rendered after the label. */
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', leftIcon, rightIcon, fullWidth, className, children, type, ...rest },
  ref,
) {
  // Destructive always carries an icon affordance (§17). Fall back to a warning
  // glyph when the caller supplied neither.
  const resolvedLeft =
    leftIcon ?? (variant === 'destructive' && !rightIcon ? <IconAlertTriangle /> : undefined);

  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(
        'inline-flex items-center justify-center font-semibold select-none',
        'transition-[background-color,color,filter,border-color] motion-reduce:transition-none',
        'disabled:opacity-50 disabled:pointer-events-none',
        FOCUS_RING,
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {resolvedLeft ? <span className="inline-flex shrink-0 text-[1.15em]">{resolvedLeft}</span> : null}
      {children != null ? <span>{children}</span> : null}
      {rightIcon ? <span className="inline-flex shrink-0 text-[1.15em]">{rightIcon}</span> : null}
    </button>
  );
});
