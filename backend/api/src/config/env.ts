import { z } from 'zod';

/**
 * Environment loader (§12, §16.1). Every process boundary reads config through
 * `loadEnv()` so the shape is validated once and shared as a frozen object.
 *
 * Two database roles back the RLS posture (P02):
 * - `AUTH_DATABASE_URL` → `intown_auth` (BYPASSRLS): Auth.js session/account
 *   store; must see every row regardless of the request user.
 * - `APP_DATABASE_URL` → `intown_app` (no BYPASSRLS): every request handler,
 *   so row-level security actually applies.
 * - `DATABASE_URL` → the migrate/superuser role (creates roles + schema).
 *
 * Dev defaults target the compose stack in `backend/infra/docker-compose.dev.yml`.
 * Tests inject throwaway values; production injects real secrets out-of-band.
 */

/** Parse a `"true"`/`"false"` env string into a boolean (undefined stays undefined). */
const Booleanish = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    return value.toLowerCase() === 'true' || value === '1';
  });

/** Dev-default sentinel values that must never survive into a production boot. */
const DEV_DEFAULT_AUTH_SECRET = 'dev-insecure-auth-secret-change-me-0000000000';
export const DEV_DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres_dev_password@localhost:5432/intown';
export const DEV_DEFAULT_AUTH_DATABASE_URL =
  'postgresql://intown_auth:intown_auth_dev_password@localhost:5432/intown';
export const DEV_DEFAULT_APP_DATABASE_URL =
  'postgresql://intown_app:intown_app_dev_password@localhost:5432/intown';
const DEV_DEFAULT_CORS_ORIGINS = 'http://localhost:5173,http://localhost:4173';
/** Dev passwords baked into the compose stack; rejected in prod even inside a custom URL. */
export const DEV_DEFAULT_DB_PASSWORDS = [
  'postgres_dev_password',
  'intown_auth_dev_password',
  'intown_app_dev_password',
];

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().default(DEV_DEFAULT_DATABASE_URL),
  AUTH_DATABASE_URL: z.string().default(DEV_DEFAULT_AUTH_DATABASE_URL),
  APP_DATABASE_URL: z.string().default(DEV_DEFAULT_APP_DATABASE_URL),

  /** Signs Auth.js cookies + hashes verification tokens. Real secret in prod. */
  AUTH_SECRET: z.string().min(1).default(DEV_DEFAULT_AUTH_SECRET),
  /** Absolute origin Auth.js builds callback URLs from. When unset, `trustHost` derives it from the request. Required in production. */
  AUTH_URL: z.string().optional(),

  /**
   * Exact browser origins allowed to call the API with cookies. This is a CSV
   * of origins (scheme + host + optional port, no path). Production must set it
   * explicitly to the deployed Vercel origin(s); `*` is never accepted because
   * credentialed CORS cannot be safely wildcarded.
   */
  CORS_ALLOWED_ORIGINS: z.string().default(DEV_DEFAULT_CORS_ORIGINS),

  /**
   * Registrable custom domain shared by the frontend and API (for example
   * `intown.app`). Required in production because Auth.js CSRF/PKCE cookies are
   * SameSite=Lax: unrelated `*.vercel.app` and VPS sites cannot complete the
   * credentialed sign-in POST reliably.
   */
  AUTH_COOKIE_SITE: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().default('dev-google-client-id'),
  GOOGLE_CLIENT_SECRET: z.string().default('dev-google-client-secret'),

  /** Nodemailer transport URL/DSN for the magic-link email (prod only; dev/test use the link sink). */
  EMAIL_SERVER: z.string().optional(),
  EMAIL_FROM: z.string().default('InTown <no-reply@intown.local>'),

  COOKIE_SECURE: Booleanish,

  /**
   * Reverse-proxy trust for `req.ip` (feeds the per-IP auth rate limiter).
   * Accepts `true`/`false`, an integer hop count, or a CIDR/IP list. When unset
   * it defaults to `1` hop in production (behind the VPS TLS proxy) and `false`
   * in dev/test (so `app.inject` loopback keys per call). Resolved in loadEnv.
   */
  TRUST_PROXY: z.string().optional(),

  /** Per-IP request budget on `/api/auth/*` within a 1-minute window. */
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  /** General contract-route request budget per IP within a 1-minute window. */
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().max(10_000).default(300),

  /** Fastify request-body ceiling. Keep accidental/untrusted payloads bounded. */
  API_BODY_LIMIT_BYTES: z.coerce.number().int().min(16_384).max(10_485_760).default(1_048_576),
});

/** Fastify `trustProxy` accepts a boolean, a hop count, or a CIDR/IP list string. */
export type TrustProxy = boolean | number | string;

export type LoadedEnv = Readonly<
  Omit<
    z.infer<typeof EnvSchema>,
    'COOKIE_SECURE' | 'TRUST_PROXY' | 'CORS_ALLOWED_ORIGINS'
  > & {
    COOKIE_SECURE: boolean;
    TRUST_PROXY: TrustProxy;
    CORS_ALLOWED_ORIGINS: readonly string[];
  }
>;

/** Parse and normalize a CSV of exact HTTP(S) origins. */
function parseOrigins(value: string, name: string): string[] {
  const raw = value.split(',').map((item) => item.trim());
  if (raw.some((item) => item === '')) {
    throw new Error(`${name} contains an empty origin`);
  }

  const origins = raw.map((item) => {
    if (item === '*') throw new Error(`${name} must not contain wildcard origins`);
    let url: URL;
    try {
      url = new URL(item);
    } catch {
      throw new Error(`${name} contains an invalid origin: ${item}`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`${name} origins must use http or https`);
    }
    if (
      url.username !== '' ||
      url.password !== '' ||
      url.pathname !== '/' ||
      url.search !== '' ||
      url.hash !== ''
    ) {
      throw new Error(`${name} entries must be origins only (no credentials, path, query, or hash)`);
    }
    return url.origin;
  });

  return [...new Set(origins)];
}

/** Validate an exact deployment origin and return its normalized representation. */
function parseAuthOrigin(value: string, isProduction: boolean): string {
  const origins = parseOrigins(value, 'AUTH_URL');
  if (origins.length !== 1) throw new Error('AUTH_URL must contain exactly one origin');
  const [origin] = origins;
  if (isProduction && !origin?.startsWith('https://')) {
    throw new Error('AUTH_URL must use https in production');
  }
  return origin!;
}

/** Normalize the explicitly configured schemeful-cookie site hostname. */
function parseCookieSite(value: string): string {
  const trimmed = value.trim().toLowerCase().replace(/^\./, '');
  if (trimmed === '' || trimmed.includes('/') || trimmed.includes(':')) {
    throw new Error('AUTH_COOKIE_SITE must be a bare DNS domain');
  }
  let normalized: string;
  try {
    normalized = new URL(`https://${trimmed}`).hostname;
  } catch {
    throw new Error('AUTH_COOKIE_SITE must be a valid DNS domain');
  }
  if (normalized !== trimmed || !normalized.includes('.')) {
    throw new Error('AUTH_COOKIE_SITE must be a normalized registrable custom domain');
  }
  return normalized;
}

function isWithinCookieSite(origin: string, site: string): boolean {
  const hostname = new URL(origin).hostname;
  return hostname === site || hostname.endsWith(`.${site}`);
}

/**
 * Resolve the `TRUST_PROXY` env string into Fastify's `trustProxy` shape:
 * `true`/`false` → boolean, a bare integer → hop count, anything else → the
 * literal CIDR/IP list. Unset defaults to `1` hop in production, `false` otherwise.
 */
function resolveTrustProxy(value: string | undefined, isProduction: boolean): TrustProxy {
  if (value === undefined || value.trim() === '') return isProduction ? 1 : false;
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

/**
 * Fail fast when a production boot is still carrying dev-default secrets/URLs,
 * which would otherwise silently run on the insecure committed defaults.
 */
function assertNoDevDefaultsInProduction(parsed: z.infer<typeof EnvSchema>): void {
  const problems: string[] = [];

  if (parsed.AUTH_SECRET === DEV_DEFAULT_AUTH_SECRET) {
    problems.push('AUTH_SECRET is still the dev default');
  }
  if (parsed.AUTH_URL === undefined || parsed.AUTH_URL.trim() === '') {
    problems.push('AUTH_URL must be set explicitly in production (host-header trust otherwise)');
  }
  if (parsed.CORS_ALLOWED_ORIGINS === DEV_DEFAULT_CORS_ORIGINS) {
    problems.push('CORS_ALLOWED_ORIGINS is still the dev default');
  }
  if (parsed.AUTH_COOKIE_SITE === undefined || parsed.AUTH_COOKIE_SITE.trim() === '') {
    problems.push('AUTH_COOKIE_SITE must be set explicitly in production');
  }

  const urlFields: Array<[string, string, string]> = [
    ['DATABASE_URL', parsed.DATABASE_URL, DEV_DEFAULT_DATABASE_URL],
    ['AUTH_DATABASE_URL', parsed.AUTH_DATABASE_URL, DEV_DEFAULT_AUTH_DATABASE_URL],
    ['APP_DATABASE_URL', parsed.APP_DATABASE_URL, DEV_DEFAULT_APP_DATABASE_URL],
  ];
  for (const [name, value, devDefault] of urlFields) {
    if (value === devDefault) {
      problems.push(`${name} is still the dev default`);
    } else if (DEV_DEFAULT_DB_PASSWORDS.some((pw) => value.includes(pw))) {
      problems.push(`${name} still contains a dev-default database password`);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Refusing to start in production with insecure dev defaults: ${problems.join('; ')}. ` +
        'Set real secrets/URLs (and AUTH_URL) out-of-band.',
    );
  }
}

/**
 * Validate + normalize the environment. `COOKIE_SECURE` defaults to `true` in
 * production and `false` otherwise (so the dev/test cookie names have no
 * `__Secure-` prefix and work over http). In production, `loadEnv` throws if any
 * secret/DB URL is still a committed dev default or if `AUTH_URL` is unset.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): LoadedEnv {
  const parsed = EnvSchema.parse(source);
  const isProduction = parsed.NODE_ENV === 'production';
  if (isProduction) assertNoDevDefaultsInProduction(parsed);
  const corsOrigins = parseOrigins(parsed.CORS_ALLOWED_ORIGINS, 'CORS_ALLOWED_ORIGINS');
  if (isProduction && corsOrigins.some((origin) => !origin.startsWith('https://'))) {
    throw new Error('CORS_ALLOWED_ORIGINS must contain only https origins in production');
  }
  const authUrl = parsed.AUTH_URL
    ? parseAuthOrigin(parsed.AUTH_URL, isProduction)
    : parsed.AUTH_URL;
  const cookieSite = parsed.AUTH_COOKIE_SITE
    ? parseCookieSite(parsed.AUTH_COOKIE_SITE)
    : parsed.AUTH_COOKIE_SITE;
  if (
    isProduction &&
    cookieSite &&
    authUrl &&
    (!isWithinCookieSite(authUrl, cookieSite) ||
      corsOrigins.some((origin) => !isWithinCookieSite(origin, cookieSite)))
  ) {
    throw new Error(
      'AUTH_URL and every CORS_ALLOWED_ORIGINS entry must be on AUTH_COOKIE_SITE ' +
        '(Auth.js SameSite=Lax cookie invariant)',
    );
  }
  const cookieSecure = parsed.COOKIE_SECURE ?? isProduction;
  const trustProxy = resolveTrustProxy(parsed.TRUST_PROXY, isProduction);
  return Object.freeze({
    ...parsed,
    AUTH_URL: authUrl,
    AUTH_COOKIE_SITE: cookieSite,
    CORS_ALLOWED_ORIGINS: Object.freeze(corsOrigins),
    COOKIE_SECURE: cookieSecure,
    TRUST_PROXY: trustProxy,
  });
}
