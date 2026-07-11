import { useState } from 'react';
import { Card } from '../../../design-system/index.ts';
import { PhotoSwipeDeck, weightsToInterests, type WeightMap } from '../../../onboarding/index.ts';
import type { TasteSummary } from '../../api/index.ts';
import { StillYouCard } from '../StillYouCard.tsx';

export interface TasteStepProps {
  /** First-ever trip → run the photo-swipe round; otherwise offer "still you?". */
  firstTrip: boolean;
  /** The returning user's stored taste (for the "still you?" confirmation). */
  taste: TasteSummary | null;
  /** True once the taste round is done or the pre-fill was confirmed. */
  confirmed: boolean;
  /** Fired with the ranked interests picked in the swipe round. */
  onComplete: (interests: string[]) => void;
  /** Fired when the returning user confirms their pre-filled taste. */
  onConfirm: () => void;
}

/**
 * Step 5 — photo-swipe taste round (§6.4, AC #3). A first-ever trip runs the
 * onboarding `PhotoSwipeDeck`; a returning user with a saved profile instead
 * sees the pre-filled "still you?" confirmation and can confirm in one tap (or
 * choose to re-swipe). Reuses the P05 swipe component and its weight→interest
 * serialization so taste elicitation stays identical across the app.
 */
export function TasteStep({ firstTrip, taste, confirmed, onComplete, onConfirm }: TasteStepProps) {
  const canStillYou = !firstTrip && taste !== null;
  const [mode, setMode] = useState<'still-you' | 'swipe'>(canStillYou ? 'still-you' : 'swipe');

  if (confirmed) {
    return (
      <Card why="Your taste is set — it shapes every pick from here." className="p-5">
        <h2 className="mb-1 text-lg font-semibold leading-tight text-text">Taste locked in</h2>
        <p className="text-sm text-text-secondary">
          Great — your picks are in. Tap Next to keep going.
        </p>
      </Card>
    );
  }

  if (mode === 'still-you' && taste) {
    return <StillYouCard taste={taste} onConfirm={onConfirm} onUpdate={() => setMode('swipe')} />;
  }

  return (
    <Card why="A few quick picks teach us your taste for this trip." className="p-5">
      <h2 className="mb-1 text-lg font-semibold leading-tight text-text">What are you into?</h2>
      <p className="mb-4 text-sm text-text-secondary">
        Swipe a few cards. Only the ones you like shape your plan.
      </p>
      <PhotoSwipeDeck onComplete={(weights: WeightMap) => onComplete(weightsToInterests(weights))} />
    </Card>
  );
}
