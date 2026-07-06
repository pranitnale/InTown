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
const DEV_DEFAULT_DATABASE_URL = 'postgresql://postgres:postgres_dev_password@localhost:5432/intown';
const DEV_DEFAULT_AUTH_DATABASE_URL =
  'postgresql://intown_auth:intown_auth_dev_password@localhost:5432/intown';
const DEV_DEFAULT_APP_DATABASE_URL =
  'postgresql://intown_app:intown_app_dev_password@localhost:5432/intown';
/** Dev passwords baked into the compose stack; rejected in prod even inside a custom URL. */
const DEV_DEFAULT_DB_PASSWORDS = [
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
});

/** Fastify `trustProxy` accepts a boolean, a hop count, or a CIDR/IP list string. */
export type TrustProxy = boolean | number | string;

export type LoadedEnv = Readonly<
  Omit<z.infer<typeof EnvSchema>, 'COOKIE_SECURE' | 'TRUST_PROXY'> & {
    COOKIE_SECURE: boolean;
    TRUST_PROXY: TrustProxy;
  }
>;

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
  const cookieSecure = parsed.COOKIE_SECURE ?? isProduction;
  const trustProxy = resolveTrustProxy(parsed.TRUST_PROXY, isProduction);
  return Object.freeze({ ...parsed, COOKIE_SECURE: cookieSecure, TRUST_PROXY: trustProxy });
}
