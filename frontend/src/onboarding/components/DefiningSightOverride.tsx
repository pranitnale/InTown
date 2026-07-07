import { Button, cn, IconAlertCircle } from '../../design-system/index.ts';
import {
  applyRemove,
  overrideDecision,
  type DefiningSight,
  type TasteRanking,
} from '../logic/override.ts';
import { interestLabel } from '../logic/interests.ts';

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

  // Remove is not local to this sight: it promotes the whole tag to an absolute
  // hard exclusion (§6.2), so EVERY item in that category is hidden everywhere.
  // State that consequence plainly — nothing is silently dropped (AC #3).
  const category = interestLabel(sight.interestTag).toLowerCase();
  const consequence = `Removing hides all ${category} everywhere — you can undo this under Never show me.`;

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
      <div className="flex flex-col items-stretch gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-text-tertiary">{consequence}</p>
        <Button size="sm" variant="secondary" onClick={() => onRemove(applyRemove(taste, sight))}>
          Remove
        </Button>
      </div>
    </div>
  );
}
