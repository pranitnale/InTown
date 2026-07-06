import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SessionProvider } from '../session/SessionProvider.tsx';
import { createMemoryNavigator } from '../navigation.ts';
import { createMockAuthApi } from '../api/mock.ts';
import { SignIn } from '../screens/SignIn.tsx';
import { SignUp } from '../screens/SignUp.tsx';
import { CheckEmail } from '../screens/CheckEmail.tsx';
import { AuthCallback } from '../screens/AuthCallback.tsx';
import { AuthError } from '../screens/AuthError.tsx';
import { ConsentCard } from '../consent/ConsentCard.tsx';
import { NonPersonalizedNote } from '../consent/NonPersonalizedNote.tsx';
import { createMemoryStorage } from '../consent/storage.ts';
import { PERSONALIZATION_CONSENT_COPY } from '../consent/copy.ts';

function render(node: ReactElement, initialPath = '/auth/sign-in'): string {
  const navigator = createMemoryNavigator(initialPath);
  const api = createMockAuthApi();
  // autoRefresh off: pure markup, no mount-time navigation.
  return renderToStaticMarkup(
    <SessionProvider api={api} navigator={navigator} autoRefresh={false}>
      {node}
    </SessionProvider>,
  );
}

describe('auth screens render', () => {
  it('SignIn shows magic-link + Google entry points', () => {
    const html = render(<SignIn />);
    expect(html).toContain('Sign in to InTown');
    expect(html).toContain('Send magic link');
    expect(html).toContain('Continue with Google');
    expect(html).toContain('type="email"');
  });

  it('SignUp shows account creation + Google', () => {
    const html = render(<SignUp />, '/auth/sign-up');
    expect(html).toContain('Create your InTown account');
    expect(html).toContain('Send magic link');
    expect(html).toContain('Continue with Google');
  });

  it('CheckEmail confirms the magic link was sent', () => {
    const html = render(<CheckEmail />, '/auth/check-email');
    expect(html).toContain('Check your email');
    expect(html).toContain('magic link');
  });

  it('AuthCallback shows a signing-in state', () => {
    const html = render(<AuthCallback />, '/auth/callback?code=abc');
    expect(html).toContain('Signing you in');
  });

  it('AuthError shows a recoverable failure', () => {
    const html = render(<AuthError />, '/auth/error');
    expect(html).toContain('sign you in');
    expect(html).toContain('Back to sign in');
  });

  it('ConsentCard renders the exact §16.1 personalization copy', () => {
    const html = render(<ConsentCard storage={createMemoryStorage()} />);
    expect(html).toContain(PERSONALIZATION_CONSENT_COPY);
    expect(html).toContain('Allow');
    expect(html).toContain('Not now');
  });

  it('NonPersonalizedNote explains the honest degrade', () => {
    const html = render(<NonPersonalizedNote />);
    expect(html).toContain('adapt to you');
  });
});
