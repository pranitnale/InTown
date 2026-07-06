import { useState } from 'react';
import type { StoryDefault } from '@ladle/react';
import { Toggle } from './Toggle.tsx';

export default {
  title: 'Primitives/Toggle',
} satisfies StoryDefault;

export const WithLabel = () => {
  const [on, setOn] = useState(true);
  return <Toggle checked={on} onCheckedChange={setOn} label="Show verified visits only" />;
};

export const States = () => {
  const [on, setOn] = useState(false);
  return (
    <div className="flex flex-col items-start gap-4">
      <Toggle checked={on} onCheckedChange={setOn} aria-label="Toggle" />
      <Toggle checked onCheckedChange={() => {}} label="On (disabled)" disabled />
      <Toggle checked={false} onCheckedChange={() => {}} label="Off (disabled)" disabled />
    </div>
  );
};
