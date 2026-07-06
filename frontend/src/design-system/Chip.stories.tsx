import type { StoryDefault } from '@ladle/react';
import { Chip } from './Chip.tsx';

export default {
  title: 'Primitives/Chip',
} satisfies StoryDefault;

export const AllVariants = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Chip variant="because-you-said">Because you said “quiet”</Chip>
    <Chip variant="disagreement">Split opinion</Chip>
    <Chip variant="citation">3 sources</Chip>
    <Chip variant="must-see">Must see</Chip>
    <Chip variant="caution">Closes early</Chip>
    <Chip variant="verified-visit">Verified visit</Chip>
  </div>
);

export const WithoutIcon = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Chip variant="must-see" icon={null}>
      Must see
    </Chip>
    <Chip variant="verified-visit" icon={null}>
      Verified
    </Chip>
  </div>
);
