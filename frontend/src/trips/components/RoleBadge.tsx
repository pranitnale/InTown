import type { TripRole } from '@intown/contracts/types';
import { Chip, type ChipVariant } from '../../design-system/index.ts';
import { roleLabel } from '../logic/roles.ts';

/**
 * Role → chip variant. Each role gets a visually distinct, both-theme-safe
 * design-system chip (owner = terracotta emotion accent, editor = jade verified
 * accent, viewer = neutral). Keeping the mapping here confines the
 * design-system `ChipVariant` type to the component; `logic/roles.ts` stays
 * DOM-free.
 */
const ROLE_VARIANT: Record<TripRole, ChipVariant> = {
  owner: 'must-see',
  editor: 'verified-visit',
  viewer: 'because-you-said',
};

export interface RoleBadgeProps {
  role: TripRole;
  className?: string;
}

/** The membership-role badge shown on each trip in the `/trips` list (AC #1). */
export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <Chip variant={ROLE_VARIANT[role]} className={className}>
      {roleLabel(role)}
    </Chip>
  );
}
