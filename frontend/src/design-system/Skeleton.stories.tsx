import type { StoryDefault } from '@ladle/react';
import { Skeleton } from './Skeleton.tsx';

export default {
  title: 'Primitives/Skeleton',
} satisfies StoryDefault;

export const Lines = () => (
  <div className="flex max-w-sm flex-col gap-2">
    <Skeleton height={16} width="80%" />
    <Skeleton height={16} width="60%" />
    <Skeleton height={16} width="90%" />
  </div>
);

export const Avatar = () => (
  <div className="flex items-center gap-3">
    <Skeleton circle width={48} />
    <div className="flex flex-col gap-2">
      <Skeleton height={14} width={120} />
      <Skeleton height={14} width={80} />
    </div>
  </div>
);

export const CardPlaceholder = () => (
  <div className="max-w-xs overflow-hidden rounded-xl border border-border bg-surface">
    <Skeleton height={160} className="rounded-none" />
    <div className="flex flex-col gap-2 p-3">
      <Skeleton height={18} width="70%" />
      <Skeleton height={14} width="90%" />
      <Skeleton height={14} width="40%" />
    </div>
  </div>
);
