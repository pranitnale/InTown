import type { StoryDefault } from '@ladle/react';
import { Input } from './Input.tsx';

export default {
  title: 'Primitives/Input',
} satisfies StoryDefault;

export const States = () => (
  <div className="flex max-w-sm flex-col gap-5">
    <Input label="City" placeholder="Where to?" />
    <Input label="Email" type="email" placeholder="you@example.com" helperText="We never share this." />
    <Input label="Budget per day" defaultValue="abc" errorText="Enter a number in euros." />
    <Input label="Disabled" placeholder="Unavailable" disabled />
  </div>
);
