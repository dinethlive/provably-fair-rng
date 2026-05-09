/**
 * Server entry point — starts the Hono app on the configured port.
 */

import { serve } from '@hono/node-server';

import { buildApp } from './app.js';

const { app, config } = buildApp();

const server = serve(
  {
    fetch: app.fetch,
    port: config.port,
    hostname: config.host,
  },
  (info) => {
    console.log(`[pf-rng-api] listening on http://${info.address}:${info.port}`);
    console.log(`[pf-rng-api] OpenAPI: http://${info.address}:${info.port}/openapi.json`);
    console.log(`[pf-rng-api] Docs:    http://${info.address}:${info.port}/docs`);
  },
);

const shutdown = (signal: NodeJS.Signals) => {
  console.log(`[pf-rng-api] received ${signal}, shutting down`);
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
