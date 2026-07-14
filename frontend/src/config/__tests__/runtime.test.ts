import { describe, expect, it } from 'vitest';
import { normalizeApiBaseUrl, readRuntimeConfig } from '../runtime.ts';

describe('runtime API configuration', () => {
  it('keeps an empty base URL as the intentional same-origin mode', () => {
    expect(normalizeApiBaseUrl(undefined)).toBe('');
    expect(normalizeApiBaseUrl('   ')).toBe('');
  });

  it('normalizes a valid HTTP(S) origin or base path', () => {
    expect(normalizeApiBaseUrl(' https://api.intown.example/ ')).toBe(
      'https://api.intown.example',
    );
    expect(normalizeApiBaseUrl('https://example.test/intown/api///')).toBe(
      'https://example.test/intown/api',
    );
  });

  it('rejects unsafe or ambiguous API base URLs', () => {
    expect(() => normalizeApiBaseUrl('/api')).toThrow(/absolute/);
    expect(() => normalizeApiBaseUrl('javascript:alert(1)')).toThrow(/http/);
    expect(() => normalizeApiBaseUrl('https://user:secret@example.test')).toThrow(/credentials/);
    expect(() => normalizeApiBaseUrl('https://example.test?tenant=x')).toThrow(/query/);
  });

  it('allows fixture mode only when explicitly requested in dev/test', () => {
    expect(readRuntimeConfig({ MODE: 'production' }).mockApi).toBe(false);
    expect(readRuntimeConfig({ DEV: true, VITE_API_MOCK: 'true' }).mockApi).toBe(true);
    expect(readRuntimeConfig({ MODE: 'test', VITE_API_MOCK: '1' }).mockApi).toBe(true);
    expect(() =>
      readRuntimeConfig({ MODE: 'production', VITE_API_MOCK: 'true' }),
    ).toThrow(/only in development or tests/);
  });

  it('rejects misspelled boolean flags instead of silently enabling mocks', () => {
    expect(() => readRuntimeConfig({ DEV: true, VITE_API_MOCK: 'yes' })).toThrow(/true\/false/);
  });
});
