import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  type PanInfo,
} from 'motion/react';
import { cn } from '../design-system/index.ts';

/**
 * Non-modal three-detent bottom sheet (AC #4).
 *
 * Detents: `peek` / `half` (0.5 of viewport height) / `full`. The panel is a
 * fixed, bottom-anchored surface of height = the full detent; a `y` translate
 * hides all but the active detent's worth from the bottom. Dragging updates
 * `y`; on release we settle: a fling past {@link VELOCITY_THRESHOLD} advances
 * one detent in the fling direction, otherwise it snaps to the nearest detent.
 *
 * NON-MODAL by design: it renders NO blocking scrim and does NOT trap focus, so
 * an interactive map/content behind it stays fully usable.
 *
 * SELECTED-PIN-VISIBLE seam: the sheet reports its occupied height (live during
 * drag and on settle) via {@link BottomSheetProps.onHeightChange}. A map layer
 * can subtract that height from its usable viewport and pan a selected pin into
 * the remaining area. The pan itself is a later phase; this component owns only
 * the height reporting.
 *
 * Honors `prefers-reduced-motion`: settles instantly (no spring) when set.
 */
export type Detent = 'peek' | 'half' | 'full';

/** Fling speed (px/s) past which a drag advances to the next detent. */
export const VELOCITY_THRESHOLD = 500;

const DETENT_ORDER: readonly Detent[] = ['peek', 'half', 'full'];
/** Fallback viewport height before first measurement (SSR / first paint). */
const FALLBACK_VIEWPORT = 800;
const TOP_INSET = 24; // status-bar breathing room at the full detent.
const PEEK_HEIGHT = 96; // handle + a sliver of content.
const HANDLE_HEIGHT = 48; // 48dp touch target (spec).

const SPRING = { type: 'spring' as const, stiffness: 420, damping: 40, mass: 0.9 };

export interface BottomSheetProps {
  children?: ReactNode;
  /** Accessible name for the sheet region. */
  ariaLabel?: string;
  /** Optional heading rendered beside the drag handle. */
  title?: ReactNode;
  /** Starting detent (uncontrolled). */
  initialDetent?: Detent;
  /** Fired whenever the active detent changes (tap, keyboard, or settle). */
  onDetentChange?: (detent: Detent) => void;
  /**
   * Fired with the sheet's occupied height in px — live during drag and on
   * settle. Consumers (e.g. the map) offset by this to keep a selection visible.
   */
  onHeightChange?: (heightPx: number) => void;
  className?: string;
}

function useViewportHeight(): number {
  const [height, setHeight] = useState(FALLBACK_VIEWPORT);
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => setHeight(window.innerHeight);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return height;
}

export function BottomSheet({
  children,
  ariaLabel = 'Details',
  title,
  initialDetent = 'half',
  onDetentChange,
  onHeightChange,
  className,
}: BottomSheetProps) {
  const viewportH = useViewportHeight();
  const reducedMotion = useReducedMotion();
  const [detent, setDetent] = useState<Detent>(initialDetent);
  const y = useMotionValue(0);
  const labelId = useId();

  // Visible height per detent. `full` ≈ viewport minus a top inset; the panel's
  // own box height equals the full detent, and `y` translates it down so only
  // the active detent's worth shows.
  const fullPx = Math.max(PEEK_HEIGHT, viewportH - TOP_INSET);
  const halfPx = Math.min(fullPx, Math.round(viewportH * 0.5));
  const heightFor = useCallback(
    (d: Detent): number => (d === 'full' ? fullPx : d === 'half' ? halfPx : PEEK_HEIGHT),
    [fullPx, halfPx],
  );
  // y = distance the (full-height) panel is pushed down from the full position.
  const yFor = useCallback((d: Detent): number => fullPx - heightFor(d), [fullPx, heightFor]);

  // Report occupied height live (drag frames + programmatic settles).
  useMotionValueEvent(y, 'change', (latest) => {
    onHeightChange?.(fullPx - latest);
  });

  const settle = useCallback(
    (next: Detent) => {
      setDetent(next);
      onDetentChange?.(next);
      const target = yFor(next);
      if (reducedMotion) {
        y.set(target); // instant — no spring under reduced-motion.
      } else {
        animate(y, target, SPRING);
      }
    },
    [onDetentChange, reducedMotion, y, yFor],
  );

  // Keep the sheet pinned to its detent when the viewport resizes.
  useEffect(() => {
    y.set(yFor(detent));
    onHeightChange?.(heightFor(detent));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resize-driven resync only
  }, [fullPx, halfPx]);

  const cycle = useCallback(() => {
    const idx = DETENT_ORDER.indexOf(detent);
    settle(DETENT_ORDER[(idx + 1) % DETENT_ORDER.length]!);
  }, [detent, settle]);

  const step = useCallback(
    (direction: 1 | -1) => {
      const idx = DETENT_ORDER.indexOf(detent);
      const nextIdx = Math.min(DETENT_ORDER.length - 1, Math.max(0, idx + direction));
      settle(DETENT_ORDER[nextIdx]!);
    },
    [detent, settle],
  );

  const onHandleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        step(1); // more expanded
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        step(-1); // more collapsed
      }
      // Enter/Space fall through to the button's native click → cycle().
    },
    [step],
  );

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const current = y.get();
      const velocity = info.velocity.y;
      // Detent y-values in ascending order == full → half → peek.
      const ys = DETENT_ORDER.map(yFor).slice().sort((a, b) => a - b);
      const ordered: Detent[] = ['full', 'half', 'peek'];
      let idx = 0;
      let best = Infinity;
      ys.forEach((value, i) => {
        const dist = Math.abs(value - current);
        if (dist < best) {
          best = dist;
          idx = i;
        }
      });
      if (velocity > VELOCITY_THRESHOLD) idx = Math.min(idx + 1, ys.length - 1); // fling down
      else if (velocity < -VELOCITY_THRESHOLD) idx = Math.max(idx - 1, 0); // fling up
      settle(ordered[idx]!);
    },
    [settle, y, yFor],
  );

  const dragMax = fullPx - PEEK_HEIGHT; // most-collapsed y (peek)

  return (
    <motion.section
      role="region"
      aria-labelledby={labelId}
      aria-label={ariaLabel}
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 mx-auto flex w-full max-w-[640px] flex-col',
        'rounded-t-[28px] border-t border-border bg-surface text-text',
        className,
      )}
      style={{
        y,
        height: fullPx,
        // 1dp elevation — token-derived shadow (no raw hex), consistent with .ds-shimmer.
        boxShadow: '0 -1px 4px color-mix(in oklab, var(--text) 12%, transparent)',
        touchAction: 'none',
      }}
      drag="y"
      dragConstraints={{ top: 0, bottom: dragMax }}
      dragElastic={0.04}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
    >
      <button
        type="button"
        onClick={cycle}
        onKeyDown={onHandleKeyDown}
        aria-label={`${ariaLabel} sheet — ${detent}. Arrow up to expand, arrow down to collapse, Enter to cycle.`}
        aria-expanded={detent !== 'peek'}
        className={cn(
          'flex w-full shrink-0 cursor-grab touch-none select-none items-center justify-center',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
          'active:cursor-grabbing',
        )}
        style={{ height: HANDLE_HEIGHT }}
      >
        <span aria-hidden className="h-1.5 w-10 rounded-full bg-text-tertiary" />
      </button>

      {title != null ? (
        <h2 id={labelId} className="shrink-0 px-4 pb-2 text-lg font-semibold leading-tight">
          {title}
        </h2>
      ) : (
        <span id={labelId} className="sr-only">
          {ariaLabel}
        </span>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">{children}</div>
    </motion.section>
  );
}
