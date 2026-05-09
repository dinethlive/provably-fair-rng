/**
 * Domain types for the Seed Lifecycle Manager.
 *
 * Persistence-agnostic — these types describe the shape of records as they
 * exist in memory and over the API boundary. The store interface (see
 * `./store/types.ts`) maps these to physical rows.
 */

import type { GameConfig, GameResult } from '@pf/rng-core';

export type SessionId = string;
export type SeedPairId = string;
export type RoundId = string;
export type PlayerId = string;
export type TenantId = string;

export type ClientSeedSource = 'player' | 'system-default';

export type SeedPairStatus = 'active' | 'revealed';

export type RotationTrigger = 'player-request' | 'auto-limit' | 'session-end';

/**
 * A unit of the three-party entropy structure: server seed (committed before),
 * client seed (player input), nonce range (incremented per round). Lives in
 * one of two states: `active` (in use, server seed encrypted at rest) or
 * `revealed` (rotated; full server seed retained for verification).
 */
export interface SeedPair {
  readonly id: SeedPairId;
  readonly tenantId: TenantId;
  readonly sessionId: SessionId;
  readonly playerId: PlayerId;
  readonly serverSeedCommitment: string;
  readonly serverSeed: string | null;
  readonly clientSeed: string;
  readonly clientSeedSource: ClientSeedSource;
  readonly status: SeedPairStatus;
  readonly nonceRangeStart: number;
  readonly nonceRangeEnd: number | null;
  readonly autoRotationLimit: number;
  readonly createdAt: string;
  readonly revealedAt: string | null;
  readonly rotationTrigger: RotationTrigger | null;
}

/**
 * Player session: the umbrella under which one or more seed pairs live.
 * A session is tied to a player (opaque ID; auth handled upstream) and a
 * tenant. Seed rotations within a session preserve session continuity.
 */
export interface Session {
  readonly id: SessionId;
  readonly tenantId: TenantId;
  readonly playerId: PlayerId;
  readonly currentSeedPairId: SeedPairId;
  readonly createdAt: string;
  readonly endedAt: string | null;
}

/**
 * Immutable round-level log entry — the regulatory evidence baseline.
 * Contains every field the round's HMAC output can be reconstructed from.
 *
 * `prevHash` is the previous entry's `entryHash` for this seed pair,
 * forming a hash chain (GAPS.md §B4 — tamper-evident audit log).
 */
export interface RoundLogEntry {
  readonly id: RoundId;
  readonly tenantId: TenantId;
  readonly sessionId: SessionId;
  readonly seedPairId: SeedPairId;
  readonly nonce: number;
  readonly serverSeedCommitment: string;
  readonly clientSeed: string;
  readonly clientSeedSource: ClientSeedSource;
  readonly hmacOutput: string;
  readonly cursorUsed: number;
  readonly gameConfig: GameConfig;
  readonly result: GameResult;
  readonly determinedAt: string;
  readonly prevHash: string;
  readonly entryHash: string;
}

/**
 * Aggregate report produced when a seed pair is rotated/revealed. Contains
 * the inputs and aggregate outputs needed for an independent auditor to
 * replay the seed pair's full history.
 */
export interface SeedPairSummary {
  readonly seedPairId: SeedPairId;
  readonly tenantId: TenantId;
  readonly sessionId: SessionId;
  readonly playerId: PlayerId;
  readonly serverSeed: string;
  readonly serverSeedCommitment: string;
  readonly clientSeed: string;
  readonly clientSeedSource: ClientSeedSource;
  readonly nonceRangeStart: number;
  readonly nonceRangeEnd: number;
  readonly totalRounds: number;
  readonly rotationTrigger: RotationTrigger;
  readonly createdAt: string;
  readonly revealedAt: string;
  readonly outcomeDistribution: ReadonlyArray<OutcomeDistributionEntry>;
  readonly chainTipHash: string;
}

export interface OutcomeDistributionEntry {
  readonly gameType: GameConfig['type'];
  readonly bucket: string;
  readonly count: number;
}

export interface PlaceRoundInput {
  readonly sessionId: SessionId;
  readonly gameConfig: GameConfig;
  readonly clientSeed?: string;
  readonly determinedAtIso?: string;
}

export interface PlaceRoundOutput {
  readonly entry: RoundLogEntry;
}

export interface CreateSessionInput {
  readonly tenantId: TenantId;
  readonly playerId: PlayerId;
  readonly clientSeed?: string;
  readonly autoRotationLimit?: number;
}

export interface CreateSessionOutput {
  readonly session: Session;
  readonly seedPair: SeedPair;
  readonly serverSeedCommitment: string;
}

export interface RotateSeedInput {
  readonly sessionId: SessionId;
  readonly trigger: RotationTrigger;
  readonly newClientSeed?: string;
}

export interface RotateSeedOutput {
  readonly previousSeedPair: SeedPair;
  readonly newSeedPair: SeedPair;
  readonly summary: SeedPairSummary;
}
