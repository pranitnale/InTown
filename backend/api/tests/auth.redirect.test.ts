import { describe, expect, it } from 'vitest';
import type { Adapter } from '@auth/core/adapters';
import { buildAuthConfig } from '../src/auth/config.ts';
import { loadEnv } from '../src/config/env.ts';

describe('Auth.js redirect origin guard', () => {
  const env = loadEnv({
    NODE_ENV: 'test',
    AUTH_URL: 'http://api.localhost:3000',
    CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
  } as NodeJS.ProcessEnv);
  const config = buildAuthConfig({ env, adapter: {} as Adapter, providers: [] });
  const redirect = config.callbacks?.redirect;

  it('allows the exact frontend origin and the API origin', async () => {
    expect(redirect).toBeTypeOf('function');
    await expect(
      redirect!({
        url: 'http://localhost:5173/auth/callback?done=1',
        baseUrl: 'http://api.localhost:3000',
      } as never),
    ).resolves.toBe('http://localhost:5173/auth/callback?done=1');
    await expect(
      redirect!({ url: '/api/auth/signin', baseUrl: 'http://api.localhost:3000' } as never),
    ).resolves.toBe('http://api.localhost:3000/api/auth/signin');
  });

  it('falls back to the API base for lookalike and non-http redirect targets', async () => {
    for (const url of ['http://localhost:5173.evil.example/pwn', 'javascript:alert(1)']) {
      await expect(
        redirect!({ url, baseUrl: 'http://api.localhost:3000' } as never),
      ).resolves.toBe('http://api.localhost:3000');
    }
  });
});
