import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from './utils.ts';

const MAX_BADGES = 2;

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** Photo URL for the photo-led image slot. */
  imageSrc?: string;
  imageAlt?: string;
  /** Custom image slot node; takes precedence over `imageSrc`. */
  image?: ReactNode;
  title?: ReactNode;
  /** Exactly one "why" line — the single reason this place is shown. */
  why: string;
  /** One metadata row (distance · price · rating …). `tabular-nums` applied. */
  meta?: ReactNode;
  /**
   * Up to {@link MAX_BADGES} badge nodes (e.g. `<Chip/>`). More than two are
   * dropped — the photo-led card intentionally caps at two to avoid clutter.
   */
  badges?: ReactNode[];
}

/**
 * Photo-led place card (§17): image slot, exactly one why-line, one metadata
 * row, and at most two badges (hard-capped — surplus badges are ignored, with a
 * dev-mode warning).
 */
export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { imageSrc, imageAlt = '', image, title, why, meta, badges, className, children, ...rest },
  ref,
) {
  const shownBadges = badges?.slice(0, MAX_BADGES);
  if (import.meta.env?.DEV && badges && badges.length > MAX_BADGES) {
    console.warn(
      `Card: ${badges.length} badges passed; only the first ${MAX_BADGES} are rendered.`,
    );
  }

  const hasImage = image != null || imageSrc != null;

  return (
    <article
      ref={ref}
      className={cn(
        'relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface text-text',
        className,
      )}
      {...rest}
    >
      {hasImage ? (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-border">
          {image ?? (
            <img src={imageSrc} alt={imageAlt} className="h-full w-full object-cover" loading="lazy" />
          )}
          {shownBadges && shownBadges.length > 0 ? (
            <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
              {shownBadges.map((badge, i) => (
                <span key={i}>{badge}</span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-1 p-3">
        {title != null ? <h3 className="text-base font-semibold leading-tight">{title}</h3> : null}
        <p className="truncate text-sm text-text-secondary" title={why}>
          {why}
        </p>
        {meta != null ? (
          <div className="mt-1 text-sm text-text-tertiary tabular-nums">{meta}</div>
        ) : null}
        {!hasImage && shownBadges && shownBadges.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {shownBadges.map((badge, i) => (
              <span key={i}>{badge}</span>
            ))}
          </div>
        ) : null}
        {children}
      </div>
    </article>
  );
});
