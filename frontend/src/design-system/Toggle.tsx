import { forwardRef, useId, type ReactNode } from 'react';
import { cn, FOCUS_RING } from './utils.ts';

export interface ToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Visible label rendered next to the switch. */
  label?: ReactNode;
  disabled?: boolean;
  id?: string;
  /** Used when there is no visible `label`. */
  'aria-label'?: string;
  className?: string;
}

/**
 * Accessible switch (`role="switch"` + `aria-checked`). Rendered as a native
 * `<button>`, so Space/Enter toggle it for free. On-state uses `bg-primary`
 * (function color); the thumb transition is disabled under reduced motion.
 */
export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  { checked, onCheckedChange, label, disabled, id, className, ...aria },
  ref,
) {
  const reactId = useId();
  const switchId = id ?? reactId;
  const labelId = `${switchId}-label`;

  const button = (
    <button
      ref={ref}
      id={switchId}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={label != null ? labelId : undefined}
      aria-label={label == null ? aria['aria-label'] : undefined}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full',
        'transition-colors motion-reduce:transition-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-border',
        FOCUS_RING,
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-surface shadow-sm',
          'transition-transform motion-reduce:transition-none',
          checked ? 'translate-x-[1.375rem]' : 'translate-x-0.5',
        )}
      />
    </button>
  );

  if (label == null) return button;

  return (
    <span className="inline-flex items-center gap-2">
      {button}
      <label id={labelId} htmlFor={switchId} className="text-base text-text select-none">
        {label}
      </label>
    </span>
  );
});
