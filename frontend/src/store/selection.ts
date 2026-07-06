import type { StateCreator } from 'zustand';
import type { AppState } from './app.ts';

/**
 * Selection state machine (AC #6). At most ONE of {stop, POI, leg, day} may be
 * selected at any time. Mutual exclusivity is guaranteed *by construction*: the
 * whole selection is a SINGLE field (`selection`), so writing a new
 * `{ kind, id }` structurally replaces any prior selection — there is no way to
 * hold two kinds at once. `select` never merges; it overwrites.
 */
export type SelectionKind = 'stop' | 'poi' | 'leg' | 'day';

export interface Selection {
  readonly kind: SelectionKind;
  readonly id: string;
}

export interface SelectionSlice {
  /** The single active selection, or `null` when nothing is selected. */
  selection: Selection | null;
  /** Replace any prior selection with `{ kind, id }` (clears the others). */
  select: (kind: SelectionKind, id: string) => void;
  /** Reset to no selection. */
  clearSelection: () => void;
}

export const createSelectionSlice: StateCreator<AppState, [], [], SelectionSlice> = (set) => ({
  selection: null,
  select: (kind, id) => set({ selection: { kind, id } }),
  clearSelection: () => set({ selection: null }),
});
