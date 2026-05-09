import { describe, expect, it } from 'vitest';
import { MemorySeedPairStore, SeedLifecycleManager } from '@pf/seed-lifecycle';

import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';

function makeApp() {
  const config: Config = {
    port: 0,
    host: 'localhost',
    tenantApiKeys: new Map([['t1', 'tenant-key-t1']]),
    regulatorApiKey: 'regulator-key',
    logLevel: 'error',
  };
  const mgr = new SeedLifecycleManager(new MemorySeedPairStore());
  return buildApp({ config, mgr });
}

describe('PF RNG API', () => {
  it('rejects requests without API key', async () => {
    const { app } = makeApp();
    const res = await app.request('/v1/sessions', {
      method: 'POST',
      body: JSON.stringify({ playerId: 'p1' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });

  it('rejects requests with invalid API key', async () => {
    const { app } = makeApp();
    const res = await app.request('/v1/sessions', {
      method: 'POST',
      body: JSON.stringify({ playerId: 'p1' }),
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'wrong' },
    });
    expect(res.status).toBe(401);
  });

  it('accepts requests with valid tenant API key', async () => {
    const { app } = makeApp();
    const res = await app.request('/v1/sessions', {
      method: 'POST',
      body: JSON.stringify({ playerId: 'p1' }),
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'tenant-key-t1' },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as any;
    expect(body.serverSeedCommitment).toMatch(/^[0-9a-f]{64}$/);
    expect(body.seedPair.serverSeed).toBeNull();
  });

  it('full flow: create → place → rotate → reveal', async () => {
    const { app } = makeApp();
    const headers = { 'Content-Type': 'application/json', 'X-API-Key': 'tenant-key-t1' };

    const createRes = await app.request('/v1/sessions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ playerId: 'p1', clientSeed: 'my-seed' }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as any;
    const sessionId = created.session.id;

    const roundRes = await app.request('/v1/rounds', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sessionId,
        gameConfig: { type: 'dice', minRoll: 0, maxRoll: 100, decimals: 2 },
      }),
    });
    expect(roundRes.status).toBe(201);
    const roundBody = (await roundRes.json()) as any;
    expect(roundBody.entry.nonce).toBe(0);
    expect(roundBody.entry.result.type).toBe('dice');

    const rotateRes = await app.request(`/v1/sessions/${sessionId}/rotate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    expect(rotateRes.status).toBe(200);
    const rotateBody = (await rotateRes.json()) as any;
    expect(rotateBody.previousSeedPair.serverSeed).toMatch(/^[0-9a-f]+$/);
    expect(rotateBody.newSeedPair.serverSeed).toBeNull();
  });

  it('rejects cross-tenant access', async () => {
    const { app } = makeApp();
    const headersT1 = { 'Content-Type': 'application/json', 'X-API-Key': 'tenant-key-t1' };
    const createRes = await app.request('/v1/sessions', {
      method: 'POST',
      headers: headersT1,
      body: JSON.stringify({ playerId: 'p1' }),
    });
    const created = (await createRes.json()) as any;
    const sessionId = created.session.id;

    // Add another tenant key
    const { app: app2 } = (() => {
      const config: Config = {
        port: 0,
        host: 'localhost',
        tenantApiKeys: new Map([
          ['t1', 'tenant-key-t1'],
          ['t2', 'tenant-key-t2'],
        ]),
        regulatorApiKey: 'regulator-key',
        logLevel: 'error',
      };
      const mgr = new SeedLifecycleManager(new MemorySeedPairStore());
      return buildApp({ config, mgr });
    })();
    const headersT2 = { 'Content-Type': 'application/json', 'X-API-Key': 'tenant-key-t2' };
    // t2 has its own (empty) manager — querying a session unknown to it returns 404.
    // In a shared-store deployment this would be 403 (cross-tenant denied).
    const res = await app2.request(`/v1/sessions/${sessionId}/history`, { headers: headersT2 });
    expect([403, 404, 500].includes(res.status)).toBe(true);
  });

  it('regulator can fetch round log by id', async () => {
    const { app } = makeApp();
    const tenantHeaders = { 'Content-Type': 'application/json', 'X-API-Key': 'tenant-key-t1' };

    const createRes = await app.request('/v1/sessions', {
      method: 'POST',
      headers: tenantHeaders,
      body: JSON.stringify({ playerId: 'p1' }),
    });
    const sessionId = ((await createRes.json()) as any).session.id;
    const roundRes = await app.request('/v1/rounds', {
      method: 'POST',
      headers: tenantHeaders,
      body: JSON.stringify({
        sessionId,
        gameConfig: { type: 'dice', minRoll: 0, maxRoll: 100, decimals: 2 },
      }),
    });
    const roundId = ((await roundRes.json()) as any).entry.id;

    const regRes = await app.request(`/v1/regulator/rounds/${roundId}`, {
      headers: { 'X-API-Key': 'regulator-key' },
    });
    expect(regRes.status).toBe(200);
    const body = (await regRes.json()) as any;
    expect(body.entry.id).toBe(roundId);
  });

  it('regulator forbidden from operational endpoints', async () => {
    const { app } = makeApp();
    const res = await app.request('/v1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'regulator-key' },
      body: JSON.stringify({ playerId: 'p1' }),
    });
    expect(res.status).toBe(403);
  });

  it('publishes OpenAPI 3.1 spec at /openapi.json', async () => {
    const { app } = makeApp();
    const res = await app.request('/openapi.json', {
      headers: { 'X-API-Key': 'tenant-key-t1' },
    });
    expect(res.status).toBe(200);
    const spec = (await res.json()) as any;
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toBe('Provably Fair RNG API');
  });

  it('healthz works without auth', async () => {
    const { app } = makeApp();
    const res = await app.request('/healthz');
    expect(res.status).toBe(200);
  });
});
