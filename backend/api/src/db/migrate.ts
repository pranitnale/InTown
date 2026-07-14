import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import {
  DEV_DEFAULT_APP_DATABASE_URL,
  DEV_DEFAULT_AUTH_DATABASE_URL,
  DEV_DEFAULT_DB_PASSWORDS,
} from '../config/env.ts';

const { Client } = pg;

/**
 * Advisory-lock key that serializes concurrent `migrate` runs (any two boxes
 * pointing at the same database will queue rather than race). Arbitrary
 * constant — just needs to be stable across deploys.
 */
const MIGRATION_LOCK_KEY = 908_741_001;

export type DatabaseRoleName = 'intown_auth' | 'intown_app';

export interface DatabaseRoleCredential {
  role: DatabaseRoleName;
  password: string;
}

/** Parse one application-role connection URL without exposing the URL in errors. */
function credentialFromUrl(
  field: 'AUTH_DATABASE_URL' | 'APP_DATABASE_URL',
  raw: string | undefined,
  expectedRole: DatabaseRoleName,
  isProduction: boolean,
): DatabaseRoleCredential {
  if (!raw || raw.trim() === '') {
    throw new Error(`${field} is required to provision database roles`);
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${field} must be a valid PostgreSQL connection URL`);
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error(`${field} must use the postgresql protocol`);
  }
  if (decodeURIComponent(url.username) !== expectedRole) {
    throw new Error(`${field} must authenticate as ${expectedRole}`);
  }

  let password: string;
  try {
    password = decodeURIComponent(url.password);
  } catch {
    throw new Error(`${field} contains an invalid percent-encoded password`);
  }
  if (password.length === 0) {
    throw new Error(`${field} must contain a non-empty password`);
  }
  if (password.includes('\0')) {
    throw new Error(`${field} password must not contain NUL bytes`);
  }
  if (isProduction && (password.length < 16 || DEV_DEFAULT_DB_PASSWORDS.includes(password))) {
    throw new Error(`${field} must contain a non-default password of at least 16 characters`);
  }

  return { role: expectedRole, password };
}

/**
 * Resolve the two login credentials the migration runner installs. Production
 * has no fallback: both URLs must be explicit, role-correct, and non-default.
 */
export function loadDatabaseRoleCredentials(
  source: NodeJS.ProcessEnv = process.env,
): readonly DatabaseRoleCredential[] {
  const isProduction = source.NODE_ENV === 'production';
  const authUrl =
    source.AUTH_DATABASE_URL ?? (isProduction ? undefined : DEV_DEFAULT_AUTH_DATABASE_URL);
  const appUrl =
    source.APP_DATABASE_URL ?? (isProduction ? undefined : DEV_DEFAULT_APP_DATABASE_URL);
  return Object.freeze([
    credentialFromUrl('AUTH_DATABASE_URL', authUrl, 'intown_auth', isProduction),
    credentialFromUrl('APP_DATABASE_URL', appUrl, 'intown_app', isProduction),
  ]);
}

interface RoleProvisionClient {
  query(queryText: string, values?: readonly unknown[]): Promise<unknown>;
}

/**
 * Install role passwords through the locked-down SQL boundary from 0017. Values
 * remain bind parameters: they are never interpolated into query text or logged.
 * Calling this repeatedly is intentionally idempotent.
 */
export async function provisionDatabaseRoles(
  client: RoleProvisionClient,
  credentials: readonly DatabaseRoleCredential[],
): Promise<void> {
  const byRole = new Map(credentials.map((credential) => [credential.role, credential]));
  for (const role of ['intown_auth', 'intown_app'] as const) {
    const credential = byRole.get(role);
    if (!credential) throw new Error(`Missing credential for ${role}`);
    await client.query('SELECT public.intown_provision_role($1, $2)', [role, credential.password]);
  }
}

/**
 * The canonical migrations directory (§18.3 — ONE ordered chain, never a
 * `setup.sql`). Resolved relative to THIS file so `migrate` works from any cwd,
 * whether run via `tsx src/db/migrate.ts` or from the built `dist/db/migrate.js`
 * (both live two levels below `backend/api/`, so the relative depth matches).
 */
export const MIGRATIONS_DIR = fileURLToPath(new URL('../../../db/migrations', import.meta.url));

/**
 * Pure ordering logic (unit-tested without a DB): keep only `.sql` files and
 * sort them lexically. Filenames are zero-padded (`0001_…`), so lexical order
 * is numeric order.
 */
export function orderMigrationFiles(filenames: string[]): string[] {
  return filenames
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Apply every not-yet-applied migration in `migrationsDir`, in filename order,
 * each inside its own transaction. Idempotent: already-applied files (tracked
 * in `schema_migrations`) are skipped. Safe to run repeatedly and concurrently.
 */
export async function runMigrations(
  databaseUrl: string,
  migrationsDir: string = MIGRATIONS_DIR,
  roleCredentials: readonly DatabaseRoleCredential[] = loadDatabaseRoleCredentials(),
): Promise<{ applied: string[]; skipped: string[] }> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const result: { applied: string[]; skipped: string[] } = { applied: [], skipped: [] };

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    try {
      await client.query(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
           filename   text        PRIMARY KEY,
           applied_at timestamptz NOT NULL DEFAULT now()
         )`,
      );

      const entries = await readdir(migrationsDir);
      const files = orderMigrationFiles(entries);

      const appliedRows = await client.query<{ filename: string }>(
        'SELECT filename FROM schema_migrations',
      );
      const already = new Set(appliedRows.rows.map((row) => row.filename));

      console.log(`[migrate] ${files.length} migration file(s) on disk in ${migrationsDir}`);

      for (const file of files) {
        if (already.has(file)) {
          console.log(`[migrate] skip    ${file} (already applied)`);
          result.skipped.push(file);
          continue;
        }

        const sql = await readFile(path.join(migrationsDir, file), 'utf8');
        console.log(`[migrate] apply   ${file} …`);

        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
          await client.query('COMMIT');
          result.applied.push(file);
          console.log(`[migrate] applied ${file}`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`[migrate] FAILED  ${file}: ${(err as Error).message}`);
          throw err;
        }
      }

      // Provision only after every schema migration committed. Migration 0017
      // clears legacy committed passwords first, making an interrupted rollout
      // fail closed; this step installs environment-only credentials explicitly.
      await provisionDatabaseRoles(client, roleCredentials);

      console.log(
        `[migrate] done — ${result.applied.length} applied, ${result.skipped.length} already present.`,
      );
      return result;
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    }
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('[migrate] DATABASE_URL is not set — cannot run migrations.');
    process.exit(1);
  }
  try {
    // Validate both role credentials before opening/changing the database.
    const roleCredentials = loadDatabaseRoleCredentials(process.env);
    await runMigrations(databaseUrl, MIGRATIONS_DIR, roleCredentials);
  } catch {
    process.exit(1);
  }
}

/** Only run the CLI when this module is the process entrypoint (not on import). */
const invokedDirectly =
  typeof process.argv[1] === 'string' &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  void main();
}
