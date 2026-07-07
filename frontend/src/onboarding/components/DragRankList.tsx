import { Reorder, useDragControls } from 'motion/react';
import { cn, FOCUS_RING, IconTrash } from '../../design-system/index.ts';
import { moveDown, moveUp, removeAt } from '../logic/dragRank.ts';
import { interestLabel } from '../logic/interests.ts';

export interface DragRankListProps {
  /** Ranked tags, most-preferred first (controlled). */
  values: string[];
  onChange: (next: string[]) => void;
  /** Accessible group label. */
  label: string;
  className?: string;
}

interface RowProps {
  tag: string;
  index: number;
  total: number;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}

function DragRankRow({ tag, index, total, onUp, onDown, onRemove }: RowProps) {
  const controls = useDragControls();
  const label = interestLabel(tag);
  return (
    <Reorder.Item
      value={tag}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-text"
    >
      <button
        type="button"
        aria-label={`Drag to reorder ${label}`}
        onPointerDown={(e) => controls.start(e)}
        className={cn('cursor-grab touch-none select-none px-1 text-text-tertiary active:cursor-grabbing', FOCUS_RING)}
      >
        <span aria-hidden className="text-lg leading-none">⋮⋮</span>
      </button>
      <span className="w-6 shrink-0 text-sm tabular-nums text-text-tertiary">{index + 1}.</span>
      <span className="flex-1 text-base">{label}</span>
      <button
        type="button"
        aria-label={`Move ${label} up`}
        disabled={index === 0}
        onClick={onUp}
        className={cn('rounded px-2 py-1 text-text-secondary hover:text-text disabled:opacity-30', FOCUS_RING)}
      >
        <span aria-hidden>▲</span>
      </button>
      <button
        type="button"
        aria-label={`Move ${label} down`}
        disabled={index === total - 1}
        onClick={onDown}
        className={cn('rounded px-2 py-1 text-text-secondary hover:text-text disabled:opacity-30', FOCUS_RING)}
      >
        <span aria-hidden>▼</span>
      </button>
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className={cn('rounded px-2 py-1 text-text-secondary hover:text-error', FOCUS_RING)}
      >
        <IconTrash />
      </button>
    </Reorder.Item>
  );
}

/**
 * Drag-to-rank list (AC #2). Array order IS the ranking (soft weight), most
 * preferred first — no numeric weight field. Drag via the handle (motion
 * Reorder) OR the keyboard-accessible up/down buttons; every mutation routes
 * through the pure `logic/dragRank` reducers so the ranking logic is unit-tested
 * without a DOM.
 */
export function DragRankList({ values, onChange, label, className }: DragRankListProps) {
  if (values.length === 0) {
    return (
      <p className={cn('text-sm text-text-secondary', className)}>
        Nothing to rank yet — pick a few things you&rsquo;re into first.
      </p>
    );
  }
  return (
    <Reorder.Group
      axis="y"
      values={values}
      onReorder={onChange}
      aria-label={label}
      className={cn('flex flex-col gap-2', className)}
    >
      {values.map((tag, index) => (
        <DragRankRow
          key={tag}
          tag={tag}
          index={index}
          total={values.length}
          onUp={() => onChange(moveUp(values, index))}
          onDown={() => onChange(moveDown(values, index))}
          onRemove={() => onChange(removeAt(values, index))}
        />
      ))}
    </Reorder.Group>
  );
}
