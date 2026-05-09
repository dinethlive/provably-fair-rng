/**
 * App factory — wires the seed-lifecycle manager and routes into a Hono app.
 *
 * Exported separately from `server.ts` so tests can spin up the app without
 * binding to a port.
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { MemorySeedPairStore, SeedLifecycleManager } from '@pf/seed-lifecycle';

import { loadConfig, type Config } from './config.js';
import { buildRoutes } from './routes.js';

export interface AppOptions {
  readonly config?: Config;
  readonly mgr?: SeedLifecycleManager;
}

export function buildApp(options: AppOptions = {}): { app: Hono; mgr: SeedLifecycleManager; config: Config } {
  const config = options.config ?? loadConfig();
  const mgr = options.mgr ?? new SeedLifecycleManager(new MemorySeedPairStore());

  const app = new Hono();
  app.use('*', logger());
  app.use(
    '*',
    secureHeaders({
      strictTransportSecurity: 'max-age=31536000; includeSubDomains',
      contentSecurityPolicy: { defaultSrc: ["'self'"] },
    }),
  );
  app.use(
    '*',
    cors({
      origin: '*',
      allowHeaders: ['X-API-Key', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'OPTIONS'],
    }),
  );

  app.get('/healthz', (c) => c.json({ status: 'ok', service: 'pf-rng-api', version: '0.1.0' }));

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      const code =
        err.status === 401
          ? 'unauthorized'
          : err.status === 403
            ? 'forbidden'
            : err.status === 404
              ? 'not_found'
              : 'http_error';
      return c.json({ error: { code, message: err.message } }, err.status);
    }
    const message = err instanceof Error ? err.message : 'internal error';
    if (/not found/i.test(message)) {
      return c.json({ error: { code: 'not_found', message } }, 404);
    }
    return c.json({ error: { code: 'internal_error', message } }, 500);
  });

  const routes = buildRoutes({ mgr, config });
  app.route('/', routes);

  return { app, mgr, config };
}
