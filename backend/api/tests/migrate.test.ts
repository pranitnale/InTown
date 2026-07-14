import { describe, expect, it } from 'vitest';
import {
  loadDatabaseRoleCredentials,
  orderMigrationFiles,
  provisionDatabaseRoles,
} from '../src/db/migrate.ts';

describe('orderMigrationFiles', () => {
  it('orders .sql files by their zero-padded numeric prefix', () => {
    const shuffled = ['0010_rls_triggers.sql', '0002_enums.sql', '0001_extensions.sql'];
    expect(orderMigrationFiles(shuffled)).toEqual([
      '0001_extensions.sql',
      '0002_enums.sql',
      '0010_rls_triggers.sql',
    ]);
  });

  it('keeps 0002 before 0010 (lexical order works because prefixes are padded)', () => {
    expect(orderMigrationFiles(['0100_c.sql', '0020_b.sql', '0003_a.sql'])).toEqual([
      '0003_a.sql',
      '0020_b.sql',
      '0100_c.sql',
    ]);
  });

  it('ignores non-.sql entries (README, dotfiles, dirs)', () => {
    const mixed = ['0001_a.sql', 'README.md', '.keep', 'notes.txt', '0002_b.sql'];
    expect(orderMigrationFiles(mixed)).toEqual(['0001_a.sql', '0002_b.sql']);
  });

  it('returns an empty array when there are no migrations', () => {
    expect(orderMigrationFiles(['README.md'])).toEqual([]);
  });
});

describe('database role credential provisioning', () => {
  const production = {
    NODE_ENV: 'production',
    AUTH_DATABASE_URL:
      'postgresql://intown_auth:auth-production-secret-123@db.example/intown',
    APP_DATABASE_URL: 'postgresql://intown_app:app-production-secret-1234@db.example/intown',
  } as unknown as NodeJS.ProcessEnv;

  it('fails closed when production is missing either role URL', () => {
    expect(() =>
      loadDatabaseRoleCredentials({
        NODE_ENV: 'production',
        AUTH_DATABASE_URL: production.AUTH_DATABASE_URL,
      } as NodeJS.ProcessEnv),
    ).toThrow(/APP_DATABASE_URL/);
  });

  it('rejects production default/empty/wrong-role credentials', () => {
    expect(() =>
      loadDatabaseRoleCredentials({
        ...production,
        APP_DATABASE_URL:
          'postgresql://intown_app:intown_app_dev_password@db.example/intown',
      } as NodeJS.ProcessEnv),
    ).toThrow(/non-default password/);
    expect(() =>
      loadDatabaseRoleCredentials({
        ...production,
        APP_DATABASE_URL: 'postgresql://someone_else:long-enough-password@db.example/intown',
      } as NodeJS.ProcessEnv),
    ).toThrow(/intown_app/);
  });

  it('decodes URL-escaped passwords and provisions idempotently with bind values only', async () => {
    const credentials = loadDatabaseRoleCredentials({
      ...production,
      AUTH_DATABASE_URL:
        'postgresql://intown_auth:auth-secret-with-%27quote@db.example/intown',
    } as NodeJS.ProcessEnv);
    const calls: Array<{ text: string; values?: readonly unknown[] }> = [];
    const client = {
      async query(text: string, values?: readonly unknown[]) {
        calls.push({ text, values });
      },
    };

    await provisionDatabaseRoles(client, credentials);
    await provisionDatabaseRoles(client, credentials);

    expect(calls).toHaveLength(4);
    expect(new Set(calls.map((call) => call.text))).toEqual(
      new Set(['SELECT public.intown_provision_role($1, $2)']),
    );
    expect(calls[0]!.values).toEqual(['intown_auth', "auth-secret-with-'quote"]);
    expect(calls[1]!.values?.[0]).toBe('intown_app');
    for (const call of calls) {
      expect(call.text).not.toContain(String(call.values?.[1]));
    }
  });
});
