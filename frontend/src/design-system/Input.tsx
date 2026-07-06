import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn, FOCUS_RING } from './utils.ts';
import { IconAlertCircle } from './icons.tsx';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Helper text shown below the field when there is no error. */
  helperText?: ReactNode;
  /** Error message; presence flips the field into its error state. */
  errorText?: ReactNode;
  id?: string;
  /** Optional leading adornment (icon). */
  leftIcon?: ReactNode;
}

/**
 * Labelled text input with helper/error text. Error state uses the `error`
 * token (border + inline icon + `role="alert"` message) and wires
 * `aria-invalid`/`aria-describedby`. Focus ring is the shared `--focus` token.
 * Body text is 16px to avoid iOS zoom-on-focus.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helperText, errorText, id, leftIcon, className, disabled, ...rest },
  ref,
) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const describedById = `${inputId}-desc`;
  const hasError = errorText != null && errorText !== false;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-text">
        {label}
      </label>
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border bg-surface px-3',
          'focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2 focus-within:ring-offset-bg',
          hasError ? 'border-error' : 'border-border',
          disabled && 'opacity-50',
        )}
      >
        {leftIcon ? <span className="shrink-0 text-text-tertiary">{leftIcon}</span> : null}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={helperText != null || hasError ? describedById : undefined}
          className={cn(
            'w-full bg-transparent py-2 text-base text-text placeholder:text-text-tertiary',
            'outline-none disabled:cursor-not-allowed',
            FOCUS_RING,
            'focus-visible:ring-0 focus-visible:ring-offset-0', // ring lives on the wrapper
            className,
          )}
          {...rest}
        />
        {hasError ? (
          <span className="shrink-0 text-error" aria-hidden>
            <IconAlertCircle />
          </span>
        ) : null}
      </div>
      {hasError ? (
        <p id={describedById} role="alert" className="text-sm text-error">
          {errorText}
        </p>
      ) : helperText != null ? (
        <p id={describedById} className="text-sm text-text-secondary">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});
