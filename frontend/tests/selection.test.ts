import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '../src/store/app.ts';
import type { SelectionKind } from '../src/store/app.ts';

/**
 * Proves the selection state machine (AC #6): at most one of
 * {stop, POI, leg, day} is ever selected. Because the selection lives in a
 * single store field, selecting one kind structurally clears the others.
 */
const ALL_KINDS: readonly SelectionKind[] = ['stop', 'poi', 'leg', 'day'];

describe('selection state machine (mutual exclusivity)', () => {
  beforeEach(() => {
    useAppStore.getState().clearSelection();
  });

  it('starts with no selection', () => {
    expect(useAppStore.getState().selection).toBeNull();
  });

  it('selecting a stop records exactly that selection', () => {
    useAppStore.getState().select('stop', 's1');
    expect(useAppStore.getState().selection).toEqual({ kind: 'stop', id: 's1' });
  });

  it('selecting a POI after a stop leaves ONLY the POI (stop cleared)', () => {
    useAppStore.getState().select('stop', 's1');
    useAppStore.getState().select('poi', 'p1');
    const { selection } = useAppStore.getState();
    expect(selection).toEqual({ kind: 'poi', id: 'p1' });
    expect(selection?.kind).not.toBe('stop');
  });

  it('every kind replaces the previous one — never two selections at once', () => {
    for (const kind of ALL_KINDS) {
      useAppStore.getState().select(kind, `${kind}-1`);
      const { selection } = useAppStore.getState();
      expect(selection).toEqual({ kind, id: `${kind}-1` });
    }
  });

  it('re-selecting the same kind with a new id updates the id in place', () => {
    useAppStore.getState().select('leg', 'l1');
    useAppStore.getState().select('leg', 'l2');
    expect(useAppStore.getState().selection).toEqual({ kind: 'leg', id: 'l2' });
  });

  it('clearSelection resets to null', () => {
    useAppStore.getState().select('day', 'd1');
    useAppStore.getState().clearSelection();
    expect(useAppStore.getState().selection).toBeNull();
  });
});
