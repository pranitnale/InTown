import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;

/**
 * Advisory-lock key that serializes concurrent `migrate` runs (any two boxes
 * pointing at the same database will queue rather than race). Arbitrary
 * constant — just needs to be stable across deploys.
 */
const MIGRATION_LOCK_KEY = 908_741_001;

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
    await runMigrations(databaseUrl);
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
