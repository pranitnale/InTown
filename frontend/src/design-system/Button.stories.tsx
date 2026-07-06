import type { ReactNode } from 'react';
import type { StoryDefault } from '@ladle/react';
import { Button } from './Button.tsx';
import { IconTrash, IconStar } from './icons.tsx';

export default {
  title: 'Primitives/Button',
} satisfies StoryDefault;

const Row = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-wrap items-center gap-3">{children}</div>
);

export const Variants = () => (
  <div className="flex flex-col gap-4">
    <Row>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Delete</Button>
      <Button variant="emotion" leftIcon={<IconStar />}>
        Must see
      </Button>
    </Row>
  </div>
);

export const Sizes = () => (
  <Row>
    <Button size="sm">Small</Button>
    <Button size="md">Medium</Button>
    <Button size="lg">Large</Button>
  </Row>
);

export const WithIcons = () => (
  <Row>
    <Button leftIcon={<IconStar />}>Leading</Button>
    <Button rightIcon={<IconStar />}>Trailing</Button>
    <Button variant="destructive" leftIcon={<IconTrash />}>
      Remove
    </Button>
  </Row>
);

export const Disabled = () => (
  <Row>
    <Button disabled>Primary</Button>
    <Button variant="secondary" disabled>
      Secondary
    </Button>
    <Button variant="destructive" disabled>
      Delete
    </Button>
  </Row>
);

export const FullWidth = () => (
  <div className="max-w-sm">
    <Button fullWidth>Continue</Button>
  </div>
);
