// SHIM: replace with @intown design-system primitives at P01 merge
import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Optional helper or error message rendered under the field. */
  hint?: string;
  /** When set, the field is styled/announced as invalid. */
  invalid?: boolean;
}

export function TextField({ label, hint, invalid, className, ...rest }: TextFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={hintId}
        aria-invalid={invalid || undefined}
        className={
          'rounded-lg border bg-surface px-3 py-2.5 text-sm text-text ' +
          'placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 ' +
          'focus-visible:ring-focus ' +
          (invalid ? 'border-error' : 'border-border') +
          (className ? ` ${className}` : '')
        }
        {...rest}
      />
      {hint ? (
        <p id={hintId} className={invalid ? 'text-xs text-error' : 'text-xs text-text-secondary'}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
