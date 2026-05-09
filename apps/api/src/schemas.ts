/**
 * OpenAPI/Zod schemas — single source of truth for request/response types,
 * runtime validation, AND the published OpenAPI 3.1 spec.
 */

import { z } from '@hono/zod-openapi';

const ClientSeedSourceSchema = z.enum(['player', 'system-default']).openapi({
  description: 'Whether the Client Seed was supplied by the player or system-generated.',
});

const SeedPairStatusSchema = z.enum(['active', 'revealed']).openapi({
  description: 'Active = in use; revealed = rotated and verifiable.',
});

const RotationTriggerSchema = z.enum(['player-request', 'auto-limit', 'session-end']);

export const DiceConfigSchema = z
  .object({
    type: z.literal('dice'),
    minRoll: z.number(),
    maxRoll: z.number(),
    decimals: z.number().int().min(0).max(8),
  })
  .openapi('DiceConfig');

export const CrashConfigSchema = z
  .object({
    type: z.literal('crash'),
    instantBustDivisor: z.number().int().min(2).optional(),
  })
  .openapi('CrashConfig');

export const CardsConfigSchema = z
  .object({
    type: z.literal('cards'),
    deckCount: z.number().int().min(1).max(8),
  })
  .openapi('CardsConfig');

export const SlotSymbolSchema = z.object({
  id: z.string().min(1),
  weight: z.number().int().min(1),
});

export const SlotConfigSchema = z
  .object({
    type: z.literal('slot'),
    reels: z.number().int().min(1).max(10),
    rows: z.number().int().min(1).max(10),
    symbols: z.array(SlotSymbolSchema).min(1),
  })
  .openapi('SlotConfig');

export const GameConfigSchema = z
  .union([DiceConfigSchema, CrashConfigSchema, CardsConfigSchema, SlotConfigSchema])
  .openapi('GameConfig');

export const CardSchema = z
  .object({
    suit: z.enum(['hearts', 'diamonds', 'clubs', 'spades']),
    value: z.enum(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']),
  })
  .openapi('Card');

export const GameResultSchema = z
  .union([
    z.object({ type: z.literal('dice'), roll: z.number() }),
    z.object({ type: z.literal('crash'), multiplier: z.number() }),
    z.object({ type: z.literal('cards'), deck: z.array(CardSchema) }),
    z.object({ type: z.literal('slot'), grid: z.array(z.array(z.string())) }),
  ])
  .openapi('GameResult');

export const SessionSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    playerId: z.string(),
    currentSeedPairId: z.string(),
    createdAt: z.string(),
    endedAt: z.string().nullable(),
  })
  .openapi('Session');

export const SeedPairSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    sessionId: z.string(),
    playerId: z.string(),
    serverSeedCommitment: z.string(),
    serverSeed: z.string().nullable(),
    clientSeed: z.string(),
    clientSeedSource: ClientSeedSourceSchema,
    status: SeedPairStatusSchema,
    nonceRangeStart: z.number(),
    nonceRangeEnd: z.number().nullable(),
    autoRotationLimit: z.number(),
    createdAt: z.string(),
    revealedAt: z.string().nullable(),
    rotationTrigger: RotationTriggerSchema.nullable(),
  })
  .openapi('SeedPair');

export const RoundLogEntrySchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    sessionId: z.string(),
    seedPairId: z.string(),
    nonce: z.number(),
    serverSeedCommitment: z.string(),
    clientSeed: z.string(),
    clientSeedSource: ClientSeedSourceSchema,
    hmacOutput: z.string(),
    cursorUsed: z.number(),
    gameConfig: GameConfigSchema,
    result: GameResultSchema,
    determinedAt: z.string(),
    prevHash: z.string(),
    entryHash: z.string(),
  })
  .openapi('RoundLogEntry');

export const SeedPairSummarySchema = z
  .object({
    seedPairId: z.string(),
    tenantId: z.string(),
    sessionId: z.string(),
    playerId: z.string(),
    serverSeed: z.string(),
    serverSeedCommitment: z.string(),
    clientSeed: z.string(),
    clientSeedSource: ClientSeedSourceSchema,
    nonceRangeStart: z.number(),
    nonceRangeEnd: z.number(),
    totalRounds: z.number(),
    rotationTrigger: RotationTriggerSchema,
    createdAt: z.string(),
    revealedAt: z.string(),
    chainTipHash: z.string(),
    outcomeDistribution: z.array(
      z.object({ gameType: z.string(), bucket: z.string(), count: z.number() }),
    ),
  })
  .openapi('SeedPairSummary');

export const ErrorResponseSchema = z
  .object({
    error: z.object({ code: z.string(), message: z.string() }),
  })
  .openapi('ErrorResponse');

export const CreateSessionRequestSchema = z
  .object({
    playerId: z.string().min(1),
    clientSeed: z.string().optional(),
    autoRotationLimit: z.number().int().min(1).max(1_000_000).optional(),
  })
  .openapi('CreateSessionRequest');

export const PlaceRoundRequestSchema = z
  .object({
    sessionId: z.string().min(1),
    gameConfig: GameConfigSchema,
    clientSeed: z.string().optional(),
  })
  .openapi('PlaceRoundRequest');

export const RotateRequestSchema = z
  .object({
    sessionId: z.string().min(1),
    newClientSeed: z.string().optional(),
    trigger: z.enum(['player-request']).default('player-request'),
  })
  .openapi('RotateRequest');
