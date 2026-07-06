import { Card } from '../ui/Card.tsx';
import { Button } from '../ui/Button.tsx';
import { useSession } from '../session/useSession.ts';

/** Post-magic-link confirmation: "we sent you a link". */
export function CheckEmail() {
  const { navigator } = useSession();
  return (
    <Card className="mx-auto max-w-md text-center">
      <div aria-hidden="true" className="mb-3 text-3xl">
        ✉️
      </div>
      <h1 className="mb-2 text-xl font-semibold text-text">Check your email</h1>
      <p className="mb-6 text-sm text-text-secondary">
        We sent you a magic link. Open it on this device to finish signing in. The link expires
        shortly, so use it soon.
      </p>
      <Button variant="secondary" onClick={() => navigator.navigate('/auth/sign-in')}>
        Back to sign in
      </Button>
    </Card>
  );
}
