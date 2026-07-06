import { useState } from 'react';
import type { StoryDefault } from '@ladle/react';
import { BottomSheet, type Detent } from './BottomSheet.tsx';
import { Card } from '../design-system/index.ts';

export default {
  title: 'App shell/BottomSheet',
} satisfies StoryDefault;

/**
 * The sheet is `position: fixed`. A `transform` on this wrapper establishes a
 * containing block so the fixed sheet is scoped to the story box (and to the
 * pretend "map" behind it) instead of the whole Ladle viewport.
 */
function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-border bg-bg"
      style={{ height: 460, transform: 'translateZ(0)' }}
    >
      {children}
    </div>
  );
}

export const ThreeDetents = () => {
  const [detent, setDetent] = useState<Detent>('half');
  const [height, setHeight] = useState(0);
  return (
    <Stage>
      {/* Pretend interactive map behind the non-modal sheet. */}
      <div className="flex h-full items-start justify-between p-4 text-sm text-text-secondary">
        <span>Map / content stays interactive (non-modal, no scrim)</span>
        <span className="tabular-nums">
          detent: {detent} · sheet {Math.round(height)}px
        </span>
      </div>
      <BottomSheet
        title="Nearby places"
        initialDetent="half"
        onDetentChange={setDetent}
        onHeightChange={setHeight}
      >
        <div className="flex flex-col gap-3">
          {['Café Central', 'Old Town Walk', 'River Viewpoint'].map((name) => (
            <Card key={name} title={name} why="A short reason this place is shown." />
          ))}
        </div>
      </BottomSheet>
    </Stage>
  );
};
