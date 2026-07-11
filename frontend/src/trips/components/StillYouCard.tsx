import { Button, Card } from '../../design-system/index.ts';
import { BecauseYouSaidChips } from '../../onboarding/index.ts';
import type { TasteSummary } from '../api/index.ts';

export interface StillYouCardProps {
  /** The returning user's stored taste, resurfaced as "because you said" chips. */
  taste: TasteSummary;
  /** Confirm the pre-filled taste still fits (skips the swipe round). */
  onConfirm: () => void;
  /** Re-run the photo-swipe round to update picks. */
  onUpdate: () => void;
}

/**
 * Returning-user "still you?" confirmation (AC #3). Instead of re-running the
 * photo-swipe round, we show the user's stored taste and let them confirm it in
 * one tap (or choose to update it). This is the sub-2-minute path for returning
 * users (§6.4). Reuses the onboarding `BecauseYouSaidChips` so the "we remember
 * what you told us" surface stays identical across the app.
 */
export function StillYouCard({ taste, onConfirm, onUpdate }: StillYouCardProps) {
  return (
    <Card why="We reused your saved taste so you can skip the swipe round." className="p-5">
      <h2 className="mb-1 text-lg font-semibold leading-tight text-text">Still you?</h2>
      <p className="mb-4 text-sm text-text-secondary">
        Here’s what we already know about your taste. Confirm it and we’ll shape this trip the same
        way — or update your picks.
      </p>
      <BecauseYouSaidChips taste={taste} className="mb-4" />
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={onConfirm}>
          Yes, still me
        </Button>
        <Button variant="secondary" onClick={onUpdate}>
          Update my picks
        </Button>
      </div>
    </Card>
  );
}
