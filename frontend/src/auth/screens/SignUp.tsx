import type { FormEvent } from 'react';
import { useState } from 'react';
import { Card } from '../ui/Card.tsx';
import { Button } from '../ui/Button.tsx';
import { OAuthButton } from '../ui/OAuthButton.tsx';
import { TextField } from '../ui/TextField.tsx';
import { useSession } from '../session/useSession.ts';

/** Sign-up screen: same passwordless magic link + Google, framed for new users. */
export function SignUp() {
  const { api, navigator } = useSession();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !email) return;
    setBusy(true);
    try {
      await api.startMagicLink(email);
      navigator.navigate('/auth/check-email');
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    const { redirectUrl } = await api.startGoogleOAuth();
    if (typeof window !== 'undefined') window.location.assign(redirectUrl);
  }

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="mb-1 text-xl font-semibold text-text">Create your InTown account</h1>
      <p className="mb-6 text-sm text-text-secondary">
        Enter your email and we&rsquo;ll send a magic link to finish setting up.
      </p>
      <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Button type="submit" variant="primary" disabled={busy}>
          Send magic link
        </Button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-text-tertiary">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <OAuthButton icon="G" onClick={() => void onGoogle()}>
        Continue with Google
      </OAuthButton>
      <p className="mt-6 text-center text-sm text-text-secondary">
        Already have an account?{' '}
        <button
          type="button"
          className="font-semibold text-link underline-offset-2 hover:underline"
          onClick={() => navigator.navigate('/auth/sign-in')}
        >
          Sign in
        </button>
      </p>
    </Card>
  );
}
