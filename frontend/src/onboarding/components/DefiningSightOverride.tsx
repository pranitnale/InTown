import { Button, cn, IconAlertCircle } from '../../design-system/index.ts';
import {
  applyRemove,
  overrideDecision,
  type DefiningSight,
  type TasteRanking,
} from '../logic/override.ts';

export interface DefiningSightOverrideProps {
  taste: TasteRanking;
  sight: DefiningSight;
  /** Called with the updated taste-ranking after the user hits Remove. */
  onRemove: (next: TasteRanking) => void;
  className?: string;
}

/**
 * Museum-problem override (AC #3). When a DEFINING sight is surfaced despite a
 * LOW interest weight, this banner explains WHY it's shown and offers an
 * explicit Remove — nothing is ever silently dropped. Remove promotes the tag to
 * an absolute hard exclusion (so it never returns). If interest isn't low, or the
 * tag is already hard-excluded, the decision hides the banner (renders nothing).
 */
export function DefiningSightOverride({ taste, sight, onRemove, className }: DefiningSightOverrideProps) {
  const decision = overrideDecision(taste, sight);
  if (!decision.show) return null;

  return (
    <div
      role="note"
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 text-text',
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <span aria-hidden className="mt-0.5 text-text-secondary">
          <IconAlertCircle />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold">{sight.title}</p>
          <p className="text-sm text-text-secondary">{decision.explanation}</p>
        </div>
      </div>
      <div className="flex justify-end">
        <Button size="sm" variant="secondary" onClick={() => onRemove(applyRemove(taste, sight))}>
          Remove
        </Button>
      </div>
    </div>
  );
}
