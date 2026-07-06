/**
 * Tiny synchronous key/value seam so the consent decision can be cached locally
 * (so the first-login card only shows once) without coupling to the browser.
 */
export interface ConsentStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/** In-memory storage for dev/tests. */
export function createMemoryStorage(seed: Record<string, string> = {}): ConsentStorage {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => {
      map.set(key, value);
    },
  };
}

/** localStorage-backed storage, guarded for SSR / privacy-mode failures. */
export function createLocalStorage(): ConsentStorage {
  return {
    get(key) {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        /* ignore quota / disabled storage */
      }
    },
  };
}

/** Storage key for a given consent type's cached decision. */
export function consentDecisionKey(consentType: string): string {
  return `intown.consent.${consentType}`;
}

export type ConsentDecision = 'granted' | 'declined';

/** Read a cached consent decision (null = not decided yet → first login). */
export function readConsentDecision(
  storage: ConsentStorage,
  consentType: string,
): ConsentDecision | null {
  const value = storage.get(consentDecisionKey(consentType));
  return value === 'granted' || value === 'declined' ? value : null;
}
