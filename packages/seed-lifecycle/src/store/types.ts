/**
 * Persistence interface for the Seed Lifecycle Manager.
 *
 * Implementations enforce the PRD's hard constraints:
 *   - `appendRoundLog` MUST be append-only (no UPDATE/DELETE).
 *   - `revealSeed` is the ONLY transition that exposes a server seed.
 *   - Concurrent round determinations for the same seed pair MUST serialize
 *     `nextNonce` and `appendRoundLog` atomically.
 *
 * The in-memory store satisfies these by construction; the Postgres store
 * uses transactions + GRANT-based row immutability.
 */

import type {
  PlayerId,
  RoundId,
  RoundLogEntry,
  SeedPair,
  SeedPairId,
  SeedPairStatus,
  SeedPairSummary,
  Session,
  SessionId,
  TenantId,
} from '../types.js';

export interface CreateSessionPayload {
  readonly session: Session;
  readonly seedPair: SeedPair;
}

export interface RotatePayload {
  readonly previousSeedPairId: SeedPairId;
  readonly previousSeedPairServerSeed: string;
  readonly previousSeedPairFinalNonce: number;
  readonly previousSeedPairRevealedAt: string;
  readonly previousSeedPairTrigger: SeedPair['rotationTrigger'];
  readonly newSeedPair: SeedPair;
  readonly summary: SeedPairSummary;
  readonly sessionUpdate: Pick<Session, 'id' | 'currentSeedPairId'>;
}

export interface NextNonceContext {
  readonly seedPairId: SeedPairId;
}

export interface SeedPairStore {
  createSession(payload: CreateSessionPayload): Promise<void>;
  endSession(sessionId: SessionId, endedAtIso: string): Promise<void>;

  getSession(sessionId: SessionId): Promise<Session | null>;
  getSeedPair(seedPairId: SeedPairId): Promise<SeedPair | null>;
  getActiveSeedPair(sessionId: SessionId): Promise<SeedPair | null>;
  getSeedPairsForSession(sessionId: SessionId): Promise<ReadonlyArray<SeedPair>>;

  /**
   * Atomically reserve the next Nonce for a seed pair AND return the seed
   * pair's current state (committed view). Implementations must hold a
   * row-level lock or equivalent so two concurrent calls cannot return the
   * same Nonce.
   */
  reserveNextNonce(ctx: NextNonceContext): Promise<{ nonce: number; seedPair: SeedPair }>;

  /**
   * Append a round log entry. MUST be append-only — implementations must
   * reject any attempt to update or delete previously written rows.
   */
  appendRoundLog(entry: RoundLogEntry): Promise<void>;
  getRoundLog(roundId: RoundId): Promise<RoundLogEntry | null>;
  getRoundLogsForSeedPair(seedPairId: SeedPairId): Promise<ReadonlyArray<RoundLogEntry>>;
  getLatestRoundForSeedPair(seedPairId: SeedPairId): Promise<RoundLogEntry | null>;

  /**
   * Mark a seed pair as revealed and record the rotation in one transaction.
   * Stores the seed pair summary alongside.
   */
  rotateSeedPair(payload: RotatePayload): Promise<void>;

  getSeedPairSummary(seedPairId: SeedPairId): Promise<SeedPairSummary | null>;

  /** For regulator-only API: list rounds across tenant in time range. */
  queryRounds(filter: {
    tenantId: TenantId;
    fromIso: string;
    toIso: string;
    limit: number;
  }): Promise<ReadonlyArray<RoundLogEntry>>;

  /** For player history. */
  getSessionsForPlayer(playerId: PlayerId, tenantId: TenantId): Promise<ReadonlyArray<Session>>;

  // Internal helpers used by the manager
  countSeedPairsByStatus(status: SeedPairStatus): Promise<number>;
}
