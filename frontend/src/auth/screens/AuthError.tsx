import { Card } from '../ui/Card.tsx';
import { Button } from '../ui/Button.tsx';
import { Banner } from '../ui/Banner.tsx';
import { useSession } from '../session/useSession.ts';

/** Sign-in failure screen. Uses the error family + icon (never terracotta). */
export function AuthError() {
  const { navigator } = useSession();
  return (
    <Card className="mx-auto max-w-md">
      <h1 className="mb-3 text-xl font-semibold text-text">We couldn&rsquo;t sign you in</h1>
      <Banner tone="error" title="Sign-in failed">
        Your link may have expired or already been used. Please try signing in again.
      </Banner>
      <div className="mt-6">
        <Button variant="primary" onClick={() => navigator.navigate('/auth/sign-in')}>
          Back to sign in
        </Button>
      </div>
    </Card>
  );
}
