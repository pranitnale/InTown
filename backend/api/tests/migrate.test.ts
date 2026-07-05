import { describe, expect, it } from 'vitest';
import { orderMigrationFiles } from '../src/db/migrate.ts';

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
