import type { StoryDefault } from '@ladle/react';
import { Card } from './Card.tsx';
import { Chip } from './Chip.tsx';

export default {
  title: 'Primitives/Card',
} satisfies StoryDefault;

// Network-free image slot for the catalog.
const Photo = () => (
  <div className="h-full w-full bg-gradient-to-br from-terracotta-300 to-jade-400" />
);

export const PhotoLed = () => (
  <div className="max-w-xs">
    <Card
      image={<Photo />}
      title="Café Central"
      why="Because you wanted a quiet spot near the river"
      meta={<span>0.4 km · €€ · 4.6★</span>}
      badges={[
        <Chip key="a" variant="must-see">
          Must see
        </Chip>,
        <Chip key="b" variant="verified-visit">
          Verified
        </Chip>,
      ]}
    />
  </div>
);

export const NoImage = () => (
  <div className="max-w-xs">
    <Card
      title="Riverside Walk"
      why="A short detour that matches your slow-morning plan"
      meta={<span>1.2 km · free · 12 min</span>}
      badges={[
        <Chip key="a" variant="caution">
          Muddy after rain
        </Chip>,
      ]}
    />
  </div>
);

export const BadgeCapEnforced = () => (
  <div className="max-w-xs">
    <Card
      image={<Photo />}
      title="Only two badges render"
      why="Four badges are passed; the card hard-caps at two"
      meta={<span>0.9 km · €€€</span>}
      badges={[
        <Chip key="a" variant="must-see">
          One
        </Chip>,
        <Chip key="b" variant="verified-visit">
          Two
        </Chip>,
        <Chip key="c" variant="citation">
          Three
        </Chip>,
        <Chip key="d" variant="caution">
          Four
        </Chip>,
      ]}
    />
  </div>
);
