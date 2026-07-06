import { buildServer } from './server.ts';
import { loadEnv } from './config/env.ts';
import { createPools } from './db/pool.ts';

const env = loadEnv();
const pools = createPools(env);

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

const app = buildServer({ logger: true, env, pools });

app
  .listen({ port, host })
  .then((address) => {
    app.log.info(`@intown/api listening on ${address}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
