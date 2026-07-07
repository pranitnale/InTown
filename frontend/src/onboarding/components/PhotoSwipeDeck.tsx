import { useState } from 'react';
import { motion, useMotionValue, useTransform, type PanInfo } from 'motion/react';
import { cn, FOCUS_RING } from '../../design-system/index.ts';
import { INTEREST_CARD_BY_TAG } from '../logic/interests.ts';
import { applySwipe, freshDeck, type SwipeVerdict, type WeightMap } from '../logic/swipe.ts';

export interface PhotoSwipeDeckProps {
  /** Tag order to present (default: the full declared deck). */
  deck?: readonly string[];
  /** Fired once every card has a verdict; carries the initialized soft weights. */
  onComplete: (weights: WeightMap) => void;
  className?: string;
}

/** px past which a horizontal drag counts as a swipe. */
const SWIPE_THRESHOLD = 90;

/**
 * Photo-swipe taste elicitation (AC #6). One choice-based card at a time
 * ("into this?") — swipe/press PASS or LIKE, or tap LOVE. Each verdict
 * initializes a soft interest weight via `logic/swipe`; only survivors advance
 * to drag-rank. Uses `motion` for the drag gesture, with equivalent buttons so
 * it works without a pointer. Cards use token-styled tiles (no external images
 * → CSP-safe, offline-safe).
 */
export function PhotoSwipeDeck({ deck, onComplete, className }: PhotoSwipeDeckProps) {
  const order = deck ?? freshDeck();
  const [index, setIndex] = useState(0);
  const [weights, setWeights] = useState<WeightMap>({});
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-8, 8]);
  const opacity = useTransform(x, [-200, -60, 0, 60, 200], [0.4, 1, 1, 1, 0.4]);

  const tag = order[index];
  const card = tag ? INTEREST_CARD_BY_TAG.get(tag) : undefined;

  function commit(verdict: SwipeVerdict) {
    if (!tag) return;
    const next = applySwipe(weights, tag, verdict);
    setWeights(next);
    x.set(0);
    const nextIndex = index + 1;
    setIndex(nextIndex);
    if (nextIndex >= order.length) onComplete(next);
  }

  function onDragEnd(_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (info.offset.x > SWIPE_THRESHOLD) commit('like');
    else if (info.offset.x < -SWIPE_THRESHOLD) commit('pass');
    else x.set(0);
  }

  if (!tag || !card) {
    return (
      <p className={cn('text-center text-sm text-text-secondary', className)}>
        All done — thanks for the picks.
      </p>
    );
  }

  return (
    <section className={cn('flex flex-col items-center gap-5', className)} aria-label="Taste picks">
      <p className="text-sm text-text-tertiary tabular-nums">
        {index + 1} of {order.length}
      </p>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.5}
        style={{ x, rotate, opacity, touchAction: 'pan-y' }}
        onDragEnd={onDragEnd}
        className="flex aspect-[4/5] w-full max-w-xs cursor-grab flex-col justify-end overflow-hidden rounded-2xl border border-border bg-surface active:cursor-grabbing"
      >
        <div className="flex flex-1 items-center justify-center bg-bg">
          <span className="px-6 text-center text-xl font-semibold text-text">{card.label}</span>
        </div>
        <div className="border-t border-border bg-surface p-4">
          <p className="text-base font-medium text-text">Into this?</p>
          <p className="text-sm text-text-secondary">{card.blurb}</p>
        </div>
      </motion.div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => commit('pass')}
          aria-label={`Pass on ${card.label}`}
          className={cn('rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-text-secondary', FOCUS_RING)}
        >
          Pass
        </button>
        <button
          type="button"
          onClick={() => commit('like')}
          aria-label={`Like ${card.label}`}
          className={cn('rounded-full border border-primary bg-primary/10 px-5 py-2.5 text-sm font-semibold text-text', FOCUS_RING)}
        >
          Into it
        </button>
        <button
          type="button"
          onClick={() => commit('love')}
          aria-label={`Love ${card.label}`}
          className={cn('rounded-full bg-terracotta-fill px-5 py-2.5 text-sm font-semibold text-on-terracotta', FOCUS_RING)}
        >
          Love it
        </button>
      </div>
    </section>
  );
}
