/**
 * Route definitions — operational + regulatory endpoints.
 *
 * Operational (tenant role):
 *   POST /v1/sessions               create session, returns commitment
 *   POST /v1/rounds                 place round
 *   POST /v1/sessions/:id/rotate    rotate seed pair
 *   POST /v1/sessions/:id/end       end session (rotates final seed)
 *   GET  /v1/sessions/:id/history   full session history
 *
 * Regulatory (regulator role, read-only):
 *   GET  /v1/regulator/rounds/:id            single round log
 *   GET  /v1/regulator/seed-pairs/:id        seed pair record
 *   GET  /v1/regulator/seed-pairs/:id/summary aggregate report
 *   GET  /v1/regulator/rounds                tenant-scoped time-range query
 *
 * All endpoints return JSON. Errors follow the `ErrorResponse` schema.
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import type { SeedLifecycleManager } from '@pf/seed-lifecycle';

import { apiKeyMiddleware, requireRole } from './auth.js';
import type { Config } from './config.js';

// Strip readonly markers at the API boundary. Domain models are immutable;
// wire payloads are plain JSON. The cast is type-erasure only — runtime
// validation is performed by Zod via @hono/zod-openapi.
type Mutable<T> = T extends ReadonlyArray<infer U>
  ? Mutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: Mutable<T[K]> }
    : T;
const asMutable = <T,>(v: T): Mutable<T> => v as unknown as Mutable<T>;
import {
  CreateSessionRequestSchema,
  ErrorResponseSchema,
  PlaceRoundRequestSchema,
  RotateRequestSchema,
  RoundLogEntrySchema,
  SeedPairSchema,
  SeedPairSummarySchema,
  SessionSchema,
} from './schemas.js';

export interface RouteDeps {
  readonly mgr: SeedLifecycleManager;
  readonly config: Config;
}

const errorResponses = {
  400: { description: 'Bad Request', content: { 'application/json': { schema: ErrorResponseSchema } } },
  401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponseSchema } } },
  403: { description: 'Forbidden', content: { 'application/json': { schema: ErrorResponseSchema } } },
  404: { description: 'Not Found', content: { 'application/json': { schema: ErrorResponseSchema } } },
} as const;

export function buildRoutes({ mgr, config }: RouteDeps): OpenAPIHono {
  const app = new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: {
              code: 'validation_error',
              message: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
            },
          },
          400,
        );
      }
      return undefined;
    },
  });

  // Auth applies only to data endpoints. The OpenAPI spec at /openapi.json is
  // publicly readable so regulators, auditors, and integrators can review the
  // API surface before requesting credentials.
  app.use('/v1/*', apiKeyMiddleware(config));

  // ─── Operational ──────────────────────────────────────────────────────────

  const createSessionRoute = createRoute({
    method: 'post',
    path: '/v1/sessions',
    middleware: [requireRole('tenant')] as const,
    request: {
      body: { content: { 'application/json': { schema: CreateSessionRequestSchema } } },
    },
    responses: {
      201: {
        description: 'Session created',
        content: {
          'application/json': {
            schema: z.object({
              session: SessionSchema,
              seedPair: SeedPairSchema,
              serverSeedCommitment: z.string(),
            }),
          },
        },
      },
      ...errorResponses,
    },
  });
  app.openapi(createSessionRoute, async (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');
    const out = await mgr.createSession({
      tenantId: auth.tenantId!,
      playerId: body.playerId,
      ...(body.clientSeed !== undefined ? { clientSeed: body.clientSeed } : {}),
      ...(body.autoRotationLimit !== undefined
        ? { autoRotationLimit: body.autoRotationLimit }
        : {}),
    });
    return c.json(
      {
        session: out.session,
        seedPair: out.seedPair,
        serverSeedCommitment: out.serverSeedCommitment,
      },
      201,
    );
  });

  const placeRoundRoute = createRoute({
    method: 'post',
    path: '/v1/rounds',
    middleware: [requireRole('tenant')] as const,
    request: {
      body: { content: { 'application/json': { schema: PlaceRoundRequestSchema } } },
    },
    responses: {
      201: {
        description: 'Round determined',
        content: { 'application/json': { schema: z.object({ entry: RoundLogEntrySchema }) } },
      },
      ...errorResponses,
    },
  });
  app.openapi(placeRoundRoute, async (c) => {
    const auth = c.get('auth');
    const body = c.req.valid('json');
    const session = await mgr.getSessionHistory(body.sessionId).then((r) => r.session);
    if (session.tenantId !== auth.tenantId) {
      throw new HTTPException(403, { message: 'cross-tenant access' });
    }
    const config = body.gameConfig as Parameters<typeof mgr.placeRound>[0]['gameConfig'];
    const out = await mgr.placeRound({
      sessionId: body.sessionId,
      gameConfig: config,
      ...(body.clientSeed !== undefined ? { clientSeed: body.clientSeed } : {}),
    });
    return c.json({ entry: asMutable(out.entry) }, 201);
  });

  const rotateRoute = createRoute({
    method: 'post',
    path: '/v1/sessions/{sessionId}/rotate',
    middleware: [requireRole('tenant')] as const,
    request: {
      params: z.object({ sessionId: z.string() }),
      body: {
        content: {
          'application/json': {
            schema: RotateRequestSchema.omit({ sessionId: true }).optional(),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Seed rotated',
        content: {
          'application/json': {
            schema: z.object({
              previousSeedPair: SeedPairSchema,
              newSeedPair: SeedPairSchema,
              summary: SeedPairSummarySchema,
            }),
          },
        },
      },
      ...errorResponses,
    },
  });
  app.openapi(rotateRoute, async (c) => {
    const auth = c.get('auth');
    const { sessionId } = c.req.valid('param');
    const session = (await mgr.getSessionHistory(sessionId)).session;
    if (session.tenantId !== auth.tenantId) {
      throw new HTTPException(403, { message: 'cross-tenant access' });
    }
    const body = (c.req.valid('json') ?? {}) as { newClientSeed?: string };
    const out = await mgr.rotateSeed({
      sessionId,
      trigger: 'player-request',
      ...(body.newClientSeed !== undefined ? { newClientSeed: body.newClientSeed } : {}),
    });
    return c.json(asMutable(out), 200);
  });

  const endSessionRoute = createRoute({
    method: 'post',
    path: '/v1/sessions/{sessionId}/end',
    middleware: [requireRole('tenant')] as const,
    request: { params: z.object({ sessionId: z.string() }) },
    responses: {
      200: {
        description: 'Session ended',
        content: {
          'application/json': {
            schema: z.object({
              previousSeedPair: SeedPairSchema,
              newSeedPair: SeedPairSchema,
              summary: SeedPairSummarySchema,
            }),
          },
        },
      },
      ...errorResponses,
    },
  });
  app.openapi(endSessionRoute, async (c) => {
    const auth = c.get('auth');
    const { sessionId } = c.req.valid('param');
    const session = (await mgr.getSessionHistory(sessionId)).session;
    if (session.tenantId !== auth.tenantId) {
      throw new HTTPException(403, { message: 'cross-tenant access' });
    }
    const out = await mgr.endSession(sessionId);
    if (!out) {
      throw new HTTPException(404, { message: 'session not found' });
    }
    return c.json(asMutable(out), 200);
  });

  const historyRoute = createRoute({
    method: 'get',
    path: '/v1/sessions/{sessionId}/history',
    middleware: [requireRole('tenant')] as const,
    request: { params: z.object({ sessionId: z.string() }) },
    responses: {
      200: {
        description: 'Session history',
        content: {
          'application/json': {
            schema: z.object({
              session: SessionSchema,
              seedPairs: z.array(SeedPairSchema),
              rounds: z.array(RoundLogEntrySchema),
            }),
          },
        },
      },
      ...errorResponses,
    },
  });
  app.openapi(historyRoute, async (c) => {
    const auth = c.get('auth');
    const { sessionId } = c.req.valid('param');
    const out = await mgr.getSessionHistory(sessionId);
    if (out.session.tenantId !== auth.tenantId) {
      throw new HTTPException(403, { message: 'cross-tenant access' });
    }
    return c.json(asMutable(out), 200);
  });

  // ─── Regulatory (read-only across tenants) ────────────────────────────────

  const getRoundRoute = createRoute({
    method: 'get',
    path: '/v1/regulator/rounds/{roundId}',
    middleware: [requireRole('regulator')] as const,
    request: { params: z.object({ roundId: z.string() }) },
    responses: {
      200: {
        description: 'Round log',
        content: { 'application/json': { schema: z.object({ entry: RoundLogEntrySchema }) } },
      },
      ...errorResponses,
    },
  });
  app.openapi(getRoundRoute, async (c) => {
    const { roundId } = c.req.valid('param');
    const entry = await mgr.getRound(roundId);
    if (!entry) throw new HTTPException(404, { message: 'round not found' });
    return c.json({ entry: asMutable(entry) }, 200);
  });

  const getSummaryRoute = createRoute({
    method: 'get',
    path: '/v1/regulator/seed-pairs/{seedPairId}/summary',
    middleware: [requireRole('regulator')] as const,
    request: { params: z.object({ seedPairId: z.string() }) },
    responses: {
      200: {
        description: 'Seed pair summary',
        content: { 'application/json': { schema: SeedPairSummarySchema } },
      },
      ...errorResponses,
    },
  });
  app.openapi(getSummaryRoute, async (c) => {
    const { seedPairId } = c.req.valid('param');
    const summary = await mgr.getSeedPairSummary(seedPairId);
    if (!summary) throw new HTTPException(404, { message: 'summary not found' });
    return c.json(asMutable(summary), 200);
  });

  const queryRoundsRoute = createRoute({
    method: 'get',
    path: '/v1/regulator/rounds',
    middleware: [requireRole('regulator')] as const,
    request: {
      query: z.object({
        tenantId: z.string(),
        from: z.string(),
        to: z.string(),
        limit: z.coerce.number().int().min(1).max(10_000).optional(),
      }),
    },
    responses: {
      200: {
        description: 'Tenant-scoped time-range query',
        content: { 'application/json': { schema: z.object({ rounds: z.array(RoundLogEntrySchema) }) } },
      },
      ...errorResponses,
    },
  });
  app.openapi(queryRoundsRoute, async (c) => {
    const { tenantId, from, to, limit } = c.req.valid('query');
    const rounds = await mgr.queryRounds({
      tenantId,
      fromIso: from,
      toIso: to,
      ...(limit !== undefined ? { limit } : {}),
    });
    return c.json({ rounds: asMutable(rounds) }, 200);
  });

  app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'Provably Fair RNG API',
      version: '0.1.0',
      description:
        'Operational and regulatory API for the Provably Fair RNG engine. Authenticated via X-API-Key header.',
    },
    servers: [{ url: 'http://localhost:3000', description: 'Local dev' }],
  });

  return app;
}
