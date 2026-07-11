import type { TripRole } from '@intown/contracts/types';

/**
 * Role display metadata (pure). The role→visual mapping used by `RoleBadge`
 * lives in the component (it needs the design-system `ChipVariant` type); this
 * module holds only the copy, so it stays DOM- and design-system-free and is
 * trivially unit-testable.
 */
const ROLE_LABEL: Record<TripRole, string> = {
  owner: 'Owner',
  editor: 'Editor',
  viewer: 'Viewer',
};

const ROLE_DESCRIPTION: Record<TripRole, string> = {
  owner: 'You created this trip — full control over plans and sharing.',
  editor: 'You can add and change plans on this trip.',
  viewer: 'You can view this trip’s plan.',
};

export function roleLabel(role: TripRole): string {
  return ROLE_LABEL[role];
}

export function roleDescription(role: TripRole): string {
  return ROLE_DESCRIPTION[role];
}
