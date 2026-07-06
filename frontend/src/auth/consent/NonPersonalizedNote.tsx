import { Banner } from '../ui/Banner.tsx';

/**
 * Honest degrade note shown when personalization consent is declined. The app
 * stays fully functional; this only explains what changes.
 */
export function NonPersonalizedNote() {
  return (
    <Banner tone="info" title="Personalization is off">
      Recommendations won&rsquo;t adapt to you. You can turn this on anytime in Settings — the
      app works fully either way.
    </Banner>
  );
}
