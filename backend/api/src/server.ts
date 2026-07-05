import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

export interface BuildServerOptions {
  /** Fastify logger config; defaults to off so tests stay quiet. */
  logger?: FastifyServerOptions['logger'];
}

/**
 * Build the InTown API server. P00 skeleton: only the liveness probe is wired.
 * Feature routes (§11) arrive in later phases and register against this instance.
 */
export function buildServer(opts: BuildServerOptions = {}): FastifyInstance {
  const app = Fastify({ logger: opts.logger ?? false });

  app.get('/healthz', async () => ({ status: 'ok' as const }));

  return app;
}
