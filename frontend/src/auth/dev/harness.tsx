import { useState } from 'react';
import { createAuthApi } from '../api/index.ts';
import { createMemoryNavigator } from '../navigation.ts';
import { SessionProvider } from '../session/SessionProvider.tsx';
import { useSession } from '../session/useSession.ts';
import { AuthFlow } from '../routes.tsx';
import { AuthGate } from '../gate/AuthGate.tsx';
import { ConsentCard } from '../consent/ConsentCard.tsx';
import { NonPersonalizedNote } from '../consent/NonPersonalizedNote.tsx';
import { createMemoryStorage } from '../consent/storage.ts';
import { Button } from '../ui/Button.tsx';
import { Card } from '../ui/Card.tsx';

/**
 * Isolated manual-testing harness. NOT imported by main.tsx / App.tsx — it is a
 * scratch render target for `pnpm dev` and tests. It composes the mock API, a
 * memory navigator, the auth flow, a gate demo, and the consent card.
 */

function GateDemo() {
  const { status } = useSession();
  const [log, setLog] = useState<string[]>([]);
  return (
    <Card className="mx-auto mt-6 max-w-md">
      <h2 className="mb-3 text-lg font-semibold text-text">Peak-motivation gate demo</h2>
      <p className="mb-3 text-sm text-text-secondary">Session: {status}</p>
      <AuthGate>
        {({ requireAuth }) => (
          <Button onClick={() => requireAuth(() => setLog((l) => [...l, 'action ran']))}>
            Do a protected action
          </Button>
        )}
      </AuthGate>
      {log.length > 0 ? (
        <ul className="mt-3 text-sm text-text-secondary">
          {log.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

export function AuthHarness() {
  const [navigator] = useState(() => createMemoryNavigator('/auth/sign-in'));
  const [api] = useState(() => createAuthApi({ mock: true }));
  const [storage] = useState(() => createMemoryStorage());
  return (
    <SessionProvider api={api} navigator={navigator}>
      <div className="min-h-dvh bg-bg p-6">
        <AuthFlow />
        <GateDemo />
        <div className="mx-auto mt-6 max-w-md">
          <ConsentCard storage={storage} />
          <div className="mt-3">
            <NonPersonalizedNote />
          </div>
        </div>
      </div>
    </SessionProvider>
  );
}
