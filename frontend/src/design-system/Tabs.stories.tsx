import type { StoryDefault } from '@ladle/react';
import { Tabs } from './Tabs.tsx';

export default {
  title: 'Primitives/Tabs',
} satisfies StoryDefault;

export const Basic = () => (
  <div className="max-w-md">
    <Tabs
      tabs={[
        { id: 'plan', label: 'Plan', content: <p className="text-text-secondary">Your day plan.</p> },
        { id: 'map', label: 'Map', content: <p className="text-text-secondary">Map view.</p> },
        { id: 'saved', label: 'Saved', content: <p className="text-text-secondary">Saved places.</p> },
      ]}
    />
  </div>
);

export const OverflowScrollSnap = () => (
  <div className="max-w-xs">
    <Tabs
      tabs={Array.from({ length: 10 }, (_, i) => ({
        id: `t${i}`,
        label: `Category ${i + 1}`,
        content: <p className="text-text-secondary">Content {i + 1} — scroll the tab strip.</p>,
      }))}
    />
  </div>
);

export const WithDisabled = () => (
  <div className="max-w-md">
    <Tabs
      tabs={[
        { id: 'a', label: 'Available', content: <p className="text-text-secondary">A</p> },
        { id: 'b', label: 'Disabled', disabled: true, content: <p>B</p> },
        { id: 'c', label: 'Also here', content: <p className="text-text-secondary">C</p> },
      ]}
    />
  </div>
);
