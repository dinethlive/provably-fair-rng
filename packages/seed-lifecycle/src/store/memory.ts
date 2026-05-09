/**
 * In-memory store — for tests, demos, and the embedded API mode.
 *
 * Enforces the same append-only and locking semantics as the Postgres store:
 *   - `appendRoundLog` checks for duplicate `(seedPairId, nonce)` and rejects.
 *   - `reserveNextNonce` is serialized via a single per-store mutex (since
 *     Node is single-threaded the mutex is effectively the call queue;
 *     concurrent async callers see deterministic Nonce assignment).
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
import type {
  CreateSessionPayload,
  NextNonceContext,
  RotatePayload,
  SeedPairStore,
} from './types.js';

class Mutex {
  private chain: Promise<void> = Promise.resolve();
  async run<T>(fn: () => Promise<T> | T): Promise<T> {
    let resolveOuter: () => void = () => {};
    const next = new Promise<void>((r) => {
      resolveOuter = r;
    });
    const prev = this.chain;
    this.chain = prev.then(() => next);
    await prev;
    try {
      return await fn();
    } finally {
      resolveOuter();
    }
  }
}

export class MemorySeedPairStore implements SeedPairStore {
  private readonly sessions = new Map<SessionId, Session>();
  private readonly seedPairs = new Map<SeedPairId, SeedPair>();
  private readonly summaries = new Map<SeedPairId, SeedPairSummary>();
  private readonly roundLog: RoundLogEntry[] = [];
  private readonly nonceCursor = new Map<SeedPairId, number>();
  private readonly mutex = new Mutex();

  async createSession(payload: CreateSessionPayload): Promise<void> {
    if (this.sessions.has(payload.session.id)) {
      throw new Error(`session ${payload.session.id} already exists`);
    }
    if (this.seedPairs.has(payload.seedPair.id)) {
      throw new Error(`seedPair ${payload.seedPair.id} already exists`);
    }
    this.sessions.set(payload.session.id, payload.session);
    this.seedPairs.set(payload.seedPair.id, payload.seedPair);
    this.nonceCursor.set(payload.seedPair.id, payload.seedPair.nonceRangeStart);
  }

  async endSession(sessionId: SessionId, endedAtIso: string): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (!s) throw new Error(`session ${sessionId} not found`);
    if (s.endedAt !== null) throw new Error(`session ${sessionId} already ended`);
    this.sessions.set(sessionId, { ...s, endedAt: endedAtIso });
  }

  async getSession(sessionId: SessionId): Promise<Session | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async getSeedPair(seedPairId: SeedPairId): Promise<SeedPair | null> {
    return this.seedPairs.get(seedPairId) ?? null;
  }

  async getActiveSeedPair(sessionId: SessionId): Promise<SeedPair | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    return this.seedPairs.get(session.currentSeedPairId) ?? null;
  }

  async getSeedPairsForSession(sessionId: SessionId): Promise<ReadonlyArray<SeedPair>> {
    return Array.from(this.seedPairs.values()).filter((sp) => sp.sessionId === sessionId);
  }

  async reserveNextNonce(ctx: NextNonceContext): Promise<{ nonce: number; seedPair: SeedPair }> {
    return this.mutex.run(() => {
      const sp = this.seedPairs.get(ctx.seedPairId);
      if (!sp) throw new Error(`seedPair ${ctx.seedPairId} not found`);
      if (sp.status !== 'active') {
        throw new Error(`seedPair ${ctx.seedPairId} is not active (status=${sp.status})`);
      }
      const next = this.nonceCursor.get(ctx.seedPairId) ?? 0;
      this.nonceCursor.set(ctx.seedPairId, next + 1);
      return { nonce: next, seedPair: sp };
    });
  }

  async appendRoundLog(entry: RoundLogEntry): Promise<void> {
    return this.mutex.run(() => {
      const dupe = this.roundLog.find(
        (e) => e.seedPairId === entry.seedPairId && e.nonce === entry.nonce,
      );
      if (dupe) {
        throw new Error(
          `round log violates append-only: seedPair ${entry.seedPairId} nonce ${entry.nonce} already exists`,
        );
      }
      this.roundLog.push(entry);
    });
  }

  async getRoundLog(roundId: RoundId): Promise<RoundLogEntry | null> {
    return this.roundLog.find((e) => e.id === roundId) ?? null;
  }

  async getRoundLogsForSeedPair(seedPairId: SeedPairId): Promise<ReadonlyArray<RoundLogEntry>> {
    return this.roundLog.filter((e) => e.seedPairId === seedPairId).sort((a, b) => a.nonce - b.nonce);
  }

  async getLatestRoundForSeedPair(seedPairId: SeedPairId): Promise<RoundLogEntry | null> {
    const entries = this.roundLog.filter((e) => e.seedPairId === seedPairId);
    if (entries.length === 0) return null;
    return entries.reduce((acc, e) => (e.nonce > acc.nonce ? e : acc));
  }

  async rotateSeedPair(payload: RotatePayload): Promise<void> {
    return this.mutex.run(() => {
      const old = this.seedPairs.get(payload.previousSeedPairId);
      if (!old) throw new Error(`seedPair ${payload.previousSeedPairId} not found`);
      if (old.status !== 'active') {
        throw new Error(`seedPair ${payload.previousSeedPairId} not active`);
      }
      const updatedOld: SeedPair = {
        ...old,
        serverSeed: payload.previousSeedPairServerSeed,
        status: 'revealed',
        nonceRangeEnd: payload.previousSeedPairFinalNonce,
        revealedAt: payload.previousSeedPairRevealedAt,
        rotationTrigger: payload.previousSeedPairTrigger,
      };
      this.seedPairs.set(old.id, updatedOld);
      this.seedPairs.set(payload.newSeedPair.id, payload.newSeedPair);
      this.nonceCursor.set(payload.newSeedPair.id, payload.newSeedPair.nonceRangeStart);
      this.summaries.set(payload.previousSeedPairId, payload.summary);
      const session = this.sessions.get(payload.sessionUpdate.id);
      if (!session) throw new Error(`session ${payload.sessionUpdate.id} not found`);
      this.sessions.set(session.id, {
        ...session,
        currentSeedPairId: payload.sessionUpdate.currentSeedPairId,
      });
    });
  }

  async getSeedPairSummary(seedPairId: SeedPairId): Promise<SeedPairSummary | null> {
    return this.summaries.get(seedPairId) ?? null;
  }

  async queryRounds(filter: {
    tenantId: TenantId;
    fromIso: string;
    toIso: string;
    limit: number;
  }): Promise<ReadonlyArray<RoundLogEntry>> {
    return this.roundLog
      .filter(
        (e) =>
          e.tenantId === filter.tenantId &&
          e.determinedAt >= filter.fromIso &&
          e.determinedAt <= filter.toIso,
      )
      .slice(0, filter.limit);
  }

  async getSessionsForPlayer(
    playerId: PlayerId,
    tenantId: TenantId,
  ): Promise<ReadonlyArray<Session>> {
    return Array.from(this.sessions.values()).filter(
      (s) => s.playerId === playerId && s.tenantId === tenantId,
    );
  }

  async countSeedPairsByStatus(status: SeedPairStatus): Promise<number> {
    let n = 0;
    for (const sp of this.seedPairs.values()) {
      if (sp.status === status) n++;
    }
    return n;
  }
}
