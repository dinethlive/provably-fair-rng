/**
 * API key middleware (PRD Ch.6, GAPS.md §B7).
 *
 * Two roles:
 *   - `tenant` — operator: full access to their own tenant's sessions/rounds.
 *   - `regulator` — read-only access across all tenants.
 *
 * Uses constant-time comparison to defeat timing attacks. Key transport:
 * `X-API-Key` header (TLS-only in production).
 */

import { createMiddleware } from 'hono/factory';
import { timingSafeEqual } from 'node:crypto';

import type { Config } from './config.js';

export type AuthRole = 'tenant' | 'regulator';

export interface AuthContext {
  readonly role: AuthRole;
  readonly tenantId: string | null;
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function apiKeyMiddleware(config: Config) {
  return createMiddleware(async (c, next) => {
    const headerKey = c.req.header('x-api-key') ?? '';
    if (!headerKey) {
      return c.json(
        { error: { code: 'unauthorized', message: 'missing X-API-Key header' } },
        401,
      );
    }

    if (safeEqual(headerKey, config.regulatorApiKey)) {
      c.set('auth', { role: 'regulator', tenantId: null });
      return next();
    }

    for (const [tenantId, expected] of config.tenantApiKeys) {
      if (safeEqual(headerKey, expected)) {
        c.set('auth', { role: 'tenant', tenantId });
        return next();
      }
    }

    return c.json(
      { error: { code: 'unauthorized', message: 'invalid API key' } },
      401,
    );
  });
}

export function requireRole(...roles: AuthRole[]) {
  return createMiddleware(async (c, next) => {
    const auth = c.get('auth');
    if (!auth || !roles.includes(auth.role)) {
      return c.json(
        { error: { code: 'forbidden', message: `requires role: ${roles.join(' or ')}` } },
        403,
      );
    }
    return next();
  });
}
