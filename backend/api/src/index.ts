import { buildServer } from './server.ts';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

const app = buildServer({ logger: true });

app
  .listen({ port, host })
  .then((address) => {
    app.log.info(`@intown/api listening on ${address}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
