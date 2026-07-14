export interface RuntimeEnv {
  readonly DEV?: boolean;
  readonly MODE?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_MOCK?: string;
}

export interface RuntimeConfig {
  /** Normalized API origin/base path. Empty means same-origin requests. */
  apiBaseUrl: string;
  /** Fixture APIs are available only in tests or an explicitly opted-in dev build. */
  mockApi: boolean;
}

function parseBooleanFlag(value: string | undefined, name: string): boolean {
  if (value === undefined || value.trim() === '') return false;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  throw new Error(`${name} must be true/false or 1/0`);
}

/**
 * Validate the single production API seam. An empty value deliberately keeps
 * same-origin behavior; a configured value must be an HTTP(S) absolute URL.
 */
export function normalizeApiBaseUrl(value: string | undefined): string {
  const candidate = value?.trim() ?? '';
  if (!candidate) return '';

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('VITE_API_BASE_URL must be an absolute http(s) URL or empty for same-origin');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('VITE_API_BASE_URL must use http or https');
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('VITE_API_BASE_URL cannot contain credentials, a query, or a fragment');
  }

  const pathname = parsed.pathname.replace(/\/+$/, '');
  return `${parsed.origin}${pathname === '/' ? '' : pathname}`;
}

export function readRuntimeConfig(env: RuntimeEnv): RuntimeConfig {
  const mockRequested = parseBooleanFlag(env.VITE_API_MOCK, 'VITE_API_MOCK');
  const mockAllowed = env.DEV === true || env.MODE === 'test';
  if (mockRequested && !mockAllowed) {
    throw new Error('VITE_API_MOCK is allowed only in development or tests');
  }

  return {
    apiBaseUrl: normalizeApiBaseUrl(env.VITE_API_BASE_URL),
    mockApi: mockRequested,
  };
}

/** Read and validate Vite runtime configuration at the application boundary. */
export function getRuntimeConfig(): RuntimeConfig {
  return readRuntimeConfig(import.meta.env);
}
