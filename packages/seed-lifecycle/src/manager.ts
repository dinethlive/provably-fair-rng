/**
 * Seed Lifecycle Manager — the service-layer orchestrator.
 *
 * Responsibilities (PRD Ch.3, Ch.4, Ch.6):
 *   - Generate Server Seeds via OS CSPRNG.
 *   - Produce SHA-256 commitment before a player's first round.
 *   - Track Nonce per active seed pair (atomic increment).
 *   - Trigger rotations: player-request, auto-limit (default 10000 rounds),
 *     session-end.
 *   - Reveal seed on rotation; produce seed pair summary.
 *   - Append immutable round-level log with hash chain.
 *
 * Hard-constraint enforcement (PRD Ch.7):
 *   - Throws if a round is requested for a seed pair past its rotation
 *     limit (caller must rotate first).
 *   - Throws if a duplicate (seedPair, nonce) is appended.
 *   - Never returns or logs an active (unrevealed) Server Seed.
 */

import {
  HmacByteStream,
  commitmentOf,
  determineRound,
  type GameConfig,
  type GameResult,
  type RoundInput,
} from '@pf/rng-core';

import { generateClientSeed, generateId, generateServerSeed } from './csprng.js';
import { GENESIS_HASH, computeEntryHash } from './hash-chain.js';
import type { SeedPairStore } from './store/types.js';
import type {
  ClientSeedSource,
  CreateSessionInput,
  CreateSessionOutput,
  OutcomeDistributionEntry,
  PlaceRoundInput,
  PlaceRoundOutput,
  RotateSeedInput,
  RotateSeedOutput,
  RoundLogEntry,
  SeedPair,
  SeedPairSummary,
  Session,
  TenantId,
} from './types.js';

const DEFAULT_AUTO_ROTATION_LIMIT = 10_000;

export interface ManagerOptions {
  readonly clock: () => Date;
  readonly idGenerator: () => string;
  readonly serverSeedFactory: () => string;
  readonly defaultClientSeedFactory: () => string;
  readonly defaultAutoRotationLimit: number;
}

export const defaultManagerOptions = (): ManagerOptions => ({
  clock: () => new Date(),
  idGenerator: generateId,
  serverSeedFactory: () => generateServerSeed(32),
  defaultClientSeedFactory: () => generateClientSeed(16),
  defaultAutoRotationLimit: DEFAULT_AUTO_ROTATION_LIMIT,
});

export class SeedLifecycleManager {
  private readonly opts: ManagerOptions;

  constructor(
    private readonly store: SeedPairStore,
    options: Partial<ManagerOptions> = {},
  ) {
    this.opts = { ...defaultManagerOptions(), ...options };
  }

  async createSession(input: CreateSessionInput): Promise<CreateSessionOutput> {
    const now = this.opts.clock().toISOString();
    const sessionId = this.opts.idGenerator();
    const seedPairId = this.opts.idGenerator();

    const serverSeed = this.opts.serverSeedFactory();
    const commitment = commitmentOf(serverSeed);

    const clientSeedSource: ClientSeedSource =
      input.clientSeed === undefined ? 'system-default' : 'player';
    const clientSeed =
      input.clientSeed === undefined ? this.opts.defaultClientSeedFactory() : input.clientSeed;

    const seedPair: SeedPair = {
      id: seedPairId,
      tenantId: input.tenantId,
      sessionId,
      playerId: input.playerId,
      serverSeedCommitment: commitment,
      serverSeed,
      clientSeed,
      clientSeedSource,
      status: 'active',
      nonceRangeStart: 0,
      nonceRangeEnd: null,
      autoRotationLimit: input.autoRotationLimit ?? this.opts.defaultAutoRotationLimit,
      createdAt: now,
      revealedAt: null,
      rotationTrigger: null,
    };

    const session: Session = {
      id: sessionId,
      tenantId: input.tenantId,
      playerId: input.playerId,
      currentSeedPairId: seedPairId,
      createdAt: now,
      endedAt: null,
    };

    await this.store.createSession({
      session,
      seedPair: this.activeSeedPairForStorage(seedPair),
    });

    return {
      session,
      seedPair: this.publicView(seedPair),
      serverSeedCommitment: commitment,
    };
  }

  async placeRound(input: PlaceRoundInput): Promise<PlaceRoundOutput> {
    const session = await this.store.getSession(input.sessionId);
    if (!session) throw new Error(`session ${input.sessionId} not found`);
    if (session.endedAt !== null) {
      throw new Error(`session ${input.sessionId} already ended`);
    }

    const { nonce, seedPair } = await this.store.reserveNextNonce({
      seedPairId: session.currentSeedPairId,
    });
    if (seedPair.serverSeed === null) {
      throw new Error('invariant: active seed pair must have stored server seed');
    }
    if (nonce >= seedPair.autoRotationLimit) {
      throw new Error(
        `seedPair ${seedPair.id} reached auto-rotation limit (${seedPair.autoRotationLimit}); rotate before next round`,
      );
    }

    let effectiveClientSeed = seedPair.clientSeed;
    let effectiveSource: ClientSeedSource = seedPair.clientSeedSource;
    if (input.clientSeed !== undefined && input.clientSeed !== seedPair.clientSeed) {
      effectiveClientSeed = input.clientSeed;
      effectiveSource = 'player';
    }

    const roundInput: RoundInput = {
      serverSeed: seedPair.serverSeed,
      clientSeed: effectiveClientSeed,
      nonce,
      gameConfig: input.gameConfig,
    };
    const output = determineRound(roundInput);
    const determinedAt = input.determinedAtIso ?? this.opts.clock().toISOString();

    const previous = await this.store.getLatestRoundForSeedPair(seedPair.id);
    const prevHash = previous?.entryHash ?? GENESIS_HASH;

    const baseEntry = {
      id: this.opts.idGenerator(),
      tenantId: seedPair.tenantId,
      sessionId: session.id,
      seedPairId: seedPair.id,
      nonce,
      serverSeedCommitment: seedPair.serverSeedCommitment,
      clientSeed: effectiveClientSeed,
      clientSeedSource: effectiveSource,
      hmacOutput: output.hashes[0]?.hex ?? '',
      cursorUsed: output.cursorUsed,
      gameConfig: input.gameConfig,
      result: output.result,
      determinedAt,
      prevHash,
    } as const;

    const entryHash = computeEntryHash({ ...baseEntry });
    const entry: RoundLogEntry = { ...baseEntry, entryHash };

    await this.store.appendRoundLog(entry);
    return { entry };
  }

  async rotateSeed(input: RotateSeedInput): Promise<RotateSeedOutput> {
    const session = await this.store.getSession(input.sessionId);
    if (!session) throw new Error(`session ${input.sessionId} not found`);
    const previous = await this.store.getActiveSeedPair(input.sessionId);
    if (!previous) {
      throw new Error(`session ${input.sessionId} has no active seed pair`);
    }
    if (previous.serverSeed === null) {
      throw new Error('invariant: active seed pair must have stored server seed');
    }

    const now = this.opts.clock().toISOString();
    const finalRound = await this.store.getLatestRoundForSeedPair(previous.id);
    const finalNonce = finalRound?.nonce ?? -1;

    const newServerSeed = this.opts.serverSeedFactory();
    const newCommitment = commitmentOf(newServerSeed);

    const clientSeedSource: ClientSeedSource =
      input.newClientSeed === undefined ? previous.clientSeedSource : 'player';
    const clientSeed = input.newClientSeed ?? previous.clientSeed;

    const newSeedPair: SeedPair = {
      id: this.opts.idGenerator(),
      tenantId: previous.tenantId,
      sessionId: previous.sessionId,
      playerId: previous.playerId,
      serverSeedCommitment: newCommitment,
      serverSeed: newServerSeed,
      clientSeed,
      clientSeedSource,
      status: 'active',
      nonceRangeStart: 0,
      nonceRangeEnd: null,
      autoRotationLimit: previous.autoRotationLimit,
      createdAt: now,
      revealedAt: null,
      rotationTrigger: null,
    };

    const summary = await this.computeSummary({
      previous,
      revealedServerSeed: previous.serverSeed,
      finalNonce,
      revealedAtIso: now,
      trigger: input.trigger,
    });

    await this.store.rotateSeedPair({
      previousSeedPairId: previous.id,
      previousSeedPairServerSeed: previous.serverSeed,
      previousSeedPairFinalNonce: finalNonce,
      previousSeedPairRevealedAt: now,
      previousSeedPairTrigger: input.trigger,
      newSeedPair: this.activeSeedPairForStorage(newSeedPair),
      summary,
      sessionUpdate: { id: session.id, currentSeedPairId: newSeedPair.id },
    });

    const revealedPrevious: SeedPair = {
      ...previous,
      serverSeed: previous.serverSeed,
      status: 'revealed',
      nonceRangeEnd: finalNonce,
      revealedAt: now,
      rotationTrigger: input.trigger,
    };

    return {
      previousSeedPair: revealedPrevious,
      newSeedPair: this.publicView(newSeedPair),
      summary,
    };
  }

  async endSession(sessionId: string): Promise<RotateSeedOutput | null> {
    const session = await this.store.getSession(sessionId);
    if (!session) return null;
    if (session.endedAt !== null) return null;
    const result = await this.rotateSeed({ sessionId, trigger: 'session-end' });
    await this.store.endSession(sessionId, this.opts.clock().toISOString());
    return result;
  }

  async getSessionHistory(sessionId: string): Promise<{
    session: Session;
    seedPairs: ReadonlyArray<SeedPair>;
    rounds: ReadonlyArray<RoundLogEntry>;
  }> {
    const session = await this.store.getSession(sessionId);
    if (!session) throw new Error(`session ${sessionId} not found`);
    const seedPairsRaw = await this.store.getSeedPairsForSession(sessionId);
    const seedPairs = seedPairsRaw.map((sp) =>
      sp.status === 'active' ? this.publicView(sp) : sp,
    );
    const rounds: RoundLogEntry[] = [];
    for (const sp of seedPairs) {
      const r = await this.store.getRoundLogsForSeedPair(sp.id);
      rounds.push(...r);
    }
    return { session, seedPairs, rounds };
  }

  async getRound(roundId: string): Promise<RoundLogEntry | null> {
    return this.store.getRoundLog(roundId);
  }

  async getSeedPairSummary(seedPairId: string): Promise<SeedPairSummary | null> {
    return this.store.getSeedPairSummary(seedPairId);
  }

  async queryRounds(filter: {
    tenantId: TenantId;
    fromIso: string;
    toIso: string;
    limit?: number;
  }): Promise<ReadonlyArray<RoundLogEntry>> {
    return this.store.queryRounds({
      tenantId: filter.tenantId,
      fromIso: filter.fromIso,
      toIso: filter.toIso,
      limit: filter.limit ?? 1000,
    });
  }

  /**
   * Publish-safe view: strips the active server seed so callers cannot
   * accidentally leak it. Stored copies retain it for later revelation.
   */
  private publicView(sp: SeedPair): SeedPair {
    if (sp.status === 'active') return { ...sp, serverSeed: null };
    return sp;
  }

  private activeSeedPairForStorage(sp: SeedPair): SeedPair {
    return sp;
  }

  private async computeSummary(args: {
    previous: SeedPair;
    revealedServerSeed: string;
    finalNonce: number;
    revealedAtIso: string;
    trigger: SeedPairSummary['rotationTrigger'];
  }): Promise<SeedPairSummary> {
    const { previous, revealedServerSeed, finalNonce, revealedAtIso, trigger } = args;
    const rounds = await this.store.getRoundLogsForSeedPair(previous.id);
    const totalRounds = rounds.length;

    const distMap = new Map<string, OutcomeDistributionEntry>();
    for (const r of rounds) {
      const bucket = bucketize(r.gameConfig, r.result);
      const key = `${r.gameConfig.type}::${bucket}`;
      const existing = distMap.get(key);
      if (existing) {
        distMap.set(key, { ...existing, count: existing.count + 1 });
      } else {
        distMap.set(key, { gameType: r.gameConfig.type, bucket, count: 1 });
      }
    }

    const chainTipHash = rounds.length === 0 ? GENESIS_HASH : rounds[rounds.length - 1]!.entryHash;

    return {
      seedPairId: previous.id,
      tenantId: previous.tenantId,
      sessionId: previous.sessionId,
      playerId: previous.playerId,
      serverSeed: revealedServerSeed,
      serverSeedCommitment: previous.serverSeedCommitment,
      clientSeed: previous.clientSeed,
      clientSeedSource: previous.clientSeedSource,
      nonceRangeStart: previous.nonceRangeStart,
      nonceRangeEnd: finalNonce,
      totalRounds,
      rotationTrigger: trigger,
      createdAt: previous.createdAt,
      revealedAt: revealedAtIso,
      outcomeDistribution: Array.from(distMap.values()).sort((a, b) =>
        a.bucket.localeCompare(b.bucket),
      ),
      chainTipHash,
    };
  }
}

function bucketize(config: GameConfig, result: GameResult): string {
  if (config.type === 'dice' && result.type === 'dice') {
    const span = config.maxRoll - config.minRoll;
    const bucketSize = span / 10;
    const bucket = Math.min(9, Math.floor((result.roll - config.minRoll) / bucketSize));
    return `decile-${bucket}`;
  }
  if (config.type === 'crash' && result.type === 'crash') {
    const m = result.multiplier;
    if (m === 1.0) return 'bust';
    if (m < 2) return '[1.00,2.00)';
    if (m < 5) return '[2.00,5.00)';
    if (m < 10) return '[5.00,10.00)';
    if (m < 100) return '[10.00,100.00)';
    return '[100.00,inf)';
  }
  if (config.type === 'cards' && result.type === 'cards') {
    return `top-${result.deck[0]?.suit}-${result.deck[0]?.value}`;
  }
  if (config.type === 'slot' && result.type === 'slot') {
    return `top-${result.grid[0]?.[0]}`;
  }
  return 'unknown';
}
