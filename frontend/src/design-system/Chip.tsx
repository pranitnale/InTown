import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from './utils.ts';
import {
  IconStar,
  IconAlertTriangle,
  IconBadgeCheck,
  IconSparkle,
  IconScale,
  IconBook,
} from './icons.tsx';

/**
 * Chip variants required by the spec. Token pairing per variant is chosen so
 * every combination is safe in BOTH themes:
 *   - `must-see`       → terracotta chip tokens (`terracotta-chip-bg/-text`,
 *                        a tested pair in light AND dark). Emotion accent.
 *   - `verified-visit` → jade chip tokens (`jade-chip-bg/-text`, tested both).
 *   - `caution`        → amber signal via border + icon over a faint amber tint;
 *                        the LABEL uses the neutral `text` token (dark in light
 *                        mode → honours "amber = dark text", light in dark mode
 *                        over a dark surface). We never put text on an amber FILL.
 *   - `because-you-said` / `disagreement` / `citation` → neutral chips (text on
 *                        surface, a tested pair) with the accent expressed only
 *                        through the icon color (graphical, not body text).
 */
export type ChipVariant =
  | 'because-you-said'
  | 'disagreement'
  | 'citation'
  | 'must-see'
  | 'caution'
  | 'verified-visit';

interface ChipSpec {
  classes: string;
  icon: ReactNode;
}

const VARIANTS: Record<ChipVariant, ChipSpec> = {
  'must-see': {
    classes: 'bg-terracotta-chip-bg text-terracotta-chip-text',
    icon: <IconStar />,
  },
  'verified-visit': {
    classes: 'bg-jade-chip-bg text-jade-chip-text',
    icon: <IconBadgeCheck />,
  },
  caution: {
    classes: 'bg-warning/10 text-text border border-warning [&_.ds-chip-icon]:text-warning',
    icon: <IconAlertTriangle />,
  },
  'because-you-said': {
    classes: 'bg-surface text-text-secondary border border-border [&_.ds-chip-icon]:text-primary',
    icon: <IconSparkle />,
  },
  disagreement: {
    classes: 'bg-surface text-text-secondary border border-border [&_.ds-chip-icon]:text-text-secondary',
    icon: <IconScale />,
  },
  citation: {
    classes: 'bg-surface text-text-secondary border border-border [&_.ds-chip-icon]:text-link',
    icon: <IconBook />,
  },
};

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  variant: ChipVariant;
  /** Override the variant's default icon; pass `null` to hide it. */
  icon?: ReactNode | null;
}

export const Chip = forwardRef<HTMLSpanElement, ChipProps>(function Chip(
  { variant, icon, className, children, ...rest },
  ref,
) {
  const spec = VARIANTS[variant];
  const resolvedIcon = icon === undefined ? spec.icon : icon;

  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium whitespace-nowrap align-middle',
        spec.classes,
        className,
      )}
      {...rest}
    >
      {resolvedIcon != null ? (
        <span className="ds-chip-icon inline-flex shrink-0 text-[1.05em]">{resolvedIcon}</span>
      ) : null}
      {children}
    </span>
  );
});
