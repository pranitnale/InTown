import type { FormEvent } from 'react';
import { useState } from 'react';
import { Card } from '../ui/Card.tsx';
import { Button } from '../ui/Button.tsx';
import { OAuthButton } from '../ui/OAuthButton.tsx';
import { TextField } from '../ui/TextField.tsx';
import { useSession } from '../session/useSession.ts';

/** Sign-up screen: passwordless magic link plus Google OAuth. */
export function SignUp() {
  const { api, navigator } = useSession();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.startMagicLink(email.trim());
      if (!result.ok) throw new Error('The sign-up request was rejected');
      navigator.navigate('/auth/check-email');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the magic link');
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { redirectUrl } = await api.startGoogleOAuth();
      if (typeof window !== 'undefined') window.location.assign(redirectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Google sign-in');
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="mb-1 text-xl font-semibold text-text">Create your InTown account</h1>
      <p className="mb-6 text-sm text-text-secondary">
        Enter your email and we&rsquo;ll send a magic link to finish setting up.
      </p>
      {error ? (
        <p className="mb-4 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}
      <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          disabled={busy}
        />
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Sending...' : 'Send magic link'}
        </Button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-text-tertiary">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <OAuthButton icon="G" disabled={busy} onClick={() => void onGoogle()}>
        {busy ? 'Please wait...' : 'Continue with Google'}
      </OAuthButton>
      <p className="mt-6 text-center text-sm text-text-secondary">
        Already have an account?{' '}
        <button
          type="button"
          disabled={busy}
          className="font-semibold text-link underline-offset-2 hover:underline disabled:opacity-50"
          onClick={() => navigator.navigate('/auth/sign-in')}
        >
          Sign in
        </button>
      </p>
    </Card>
  );
}
