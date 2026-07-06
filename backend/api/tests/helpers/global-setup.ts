import pg from 'pg';
import { runMigrations } from '../../src/db/migrate.ts';

/**
 * Vitest global setup: apply the full migration chain once (idempotent) against
 * the dev/CI Postgres, then assert the two application roles that RLS depends on
 * exist. Runs before any test file.
 */
export default async function globalSetup(): Promise<void> {
  const databaseUrl =
    process.env.DATABASE_URL ?? 'postgresql://postgres:postgres_dev_password@localhost:5432/intown';

  await runMigrations(databaseUrl);

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query<{ rolname: string }>(
      "SELECT rolname FROM pg_roles WHERE rolname IN ('intown_auth', 'intown_app')",
    );
    const names = new Set(rows.map((r) => r.rolname));
    if (!names.has('intown_auth') || !names.has('intown_app')) {
      throw new Error(
        `Expected roles intown_auth + intown_app after migration; found: ${[...names].join(', ') || 'none'}`,
      );
    }
  } finally {
    await client.end();
  }
}
