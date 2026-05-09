import { beforeEach, describe, expect, it } from 'vitest';
import { commitmentOf } from '@pf/rng-core';

import { MemorySeedPairStore } from '../src/store/memory.js';
import { SeedLifecycleManager } from '../src/manager.js';
import { verifyChain } from '../src/hash-chain.js';

function makeManager() {
  const store = new MemorySeedPairStore();
  let counter = 0;
  let now = new Date('2026-05-09T00:00:00Z');
  const idGenerator = () => `id-${++counter}`;
  const seeds = [
    'a'.repeat(64),
    'b'.repeat(64),
    'c'.repeat(64),
    'd'.repeat(64),
    'e'.repeat(64),
  ];
  let seedIdx = 0;
  const serverSeedFactory = () => seeds[seedIdx++ % seeds.length]!;
  const clientSeedFactory = () => `default-client-${counter}`;
  const clock = () => new Date(now.getTime());
  const advanceClock = (ms: number) => {
    now = new Date(now.getTime() + ms);
  };

  const mgr = new SeedLifecycleManager(store, {
    idGenerator,
    serverSeedFactory,
    defaultClientSeedFactory: clientSeedFactory,
    clock,
    defaultAutoRotationLimit: 5,
  });
  return { mgr, store, advanceClock };
}

describe('SeedLifecycleManager', () => {
  let setup: ReturnType<typeof makeManager>;
  beforeEach(() => {
    setup = makeManager();
  });

  it('createSession produces commitment matching SHA-256 of revealed seed after rotation', async () => {
    const { mgr } = setup;
    const created = await mgr.createSession({ tenantId: 't1', playerId: 'p1' });
    expect(created.serverSeedCommitment).toBe(commitmentOf('a'.repeat(64)));
    expect(created.seedPair.serverSeed).toBeNull();
    const rot = await mgr.rotateSeed({ sessionId: created.session.id, trigger: 'player-request' });
    expect(rot.previousSeedPair.serverSeed).toBe('a'.repeat(64));
    expect(commitmentOf(rot.previousSeedPair.serverSeed!)).toBe(created.serverSeedCommitment);
  });

  it('placeRound increments nonce sequentially from 0', async () => {
    const { mgr } = setup;
    const { session } = await mgr.createSession({
      tenantId: 't',
      playerId: 'p',
      clientSeed: 'cs',
    });
    const r0 = await mgr.placeRound({
      sessionId: session.id,
      gameConfig: { type: 'dice', minRoll: 0, maxRoll: 100, decimals: 2 },
    });
    const r1 = await mgr.placeRound({
      sessionId: session.id,
      gameConfig: { type: 'dice', minRoll: 0, maxRoll: 100, decimals: 2 },
    });
    expect(r0.entry.nonce).toBe(0);
    expect(r1.entry.nonce).toBe(1);
  });

  it('rejects round when auto-rotation limit reached', async () => {
    const { mgr } = setup;
    const { session } = await mgr.createSession({
      tenantId: 't',
      playerId: 'p',
      clientSeed: 'cs',
      autoRotationLimit: 3,
    });
    for (let i = 0; i < 3; i++) {
      await mgr.placeRound({
        sessionId: session.id,
        gameConfig: { type: 'dice', minRoll: 0, maxRoll: 100, decimals: 2 },
      });
    }
    await expect(
      mgr.placeRound({
        sessionId: session.id,
        gameConfig: { type: 'dice', minRoll: 0, maxRoll: 100, decimals: 2 },
      }),
    ).rejects.toThrow(/auto-rotation limit/);
  });

  it('round log forms a valid hash chain', async () => {
    const { mgr, store } = setup;
    const { session, seedPair } = await mgr.createSession({
      tenantId: 't',
      playerId: 'p',
      clientSeed: 'cs',
    });
    for (let i = 0; i < 4; i++) {
      await mgr.placeRound({
        sessionId: session.id,
        gameConfig: { type: 'dice', minRoll: 0, maxRoll: 100, decimals: 2 },
      });
    }
    const rounds = await store.getRoundLogsForSeedPair(seedPair.id);
    expect(rounds).toHaveLength(4);
    const v = verifyChain(rounds);
    expect(v.valid).toBe(true);
  });

  it('append-only: cannot insert duplicate (seedPair, nonce)', async () => {
    const { mgr, store } = setup;
    const { session, seedPair } = await mgr.createSession({
      tenantId: 't',
      playerId: 'p',
      clientSeed: 'cs',
    });
    const r0 = await mgr.placeRound({
      sessionId: session.id,
      gameConfig: { type: 'dice', minRoll: 0, maxRoll: 100, decimals: 2 },
    });
    await expect(store.appendRoundLog({ ...r0.entry })).rejects.toThrow(/append-only/);
  });

  it('rotateSeed reveals server seed and sets nonceRangeEnd to last nonce', async () => {
    const { mgr } = setup;
    const { session } = await mgr.createSession({
      tenantId: 't',
      playerId: 'p',
      clientSeed: 'cs',
    });
    await mgr.placeRound({
      sessionId: session.id,
      gameConfig: { type: 'dice', minRoll: 0, maxRoll: 100, decimals: 2 },
    });
    await mgr.placeRound({
      sessionId: session.id,
      gameConfig: { type: 'dice', minRoll: 0, maxRoll: 100, decimals: 2 },
    });
    const rot = await mgr.rotateSeed({ sessionId: session.id, trigger: 'player-request' });
    expect(rot.previousSeedPair.status).toBe('revealed');
    expect(rot.previousSeedPair.nonceRangeEnd).toBe(1);
    expect(rot.previousSeedPair.serverSeed).toBe('a'.repeat(64));
    expect(rot.summary.totalRounds).toBe(2);
    expect(rot.newSeedPair.serverSeedCommitment).toBe(commitmentOf('b'.repeat(64)));
    expect(rot.newSeedPair.serverSeed).toBeNull();
  });

  it('after rotation, new rounds use new seed pair starting at nonce 0', async () => {
    const { mgr, store } = setup;
    const { session } = await mgr.createSession({
      tenantId: 't',
      playerId: 'p',
      clientSeed: 'cs',
    });
    await mgr.placeRound({
      sessionId: session.id,
      gameConfig: { type: 'dice', minRoll: 0, maxRoll: 100, decimals: 2 },
    });
    const rot = await mgr.rotateSeed({ sessionId: session.id, trigger: 'player-request' });
    const r = await mgr.placeRound({
      sessionId: session.id,
      gameConfig: { type: 'dice', minRoll: 0, maxRoll: 100, decimals: 2 },
    });
    expect(r.entry.seedPairId).toBe(rot.newSeedPair.id);
    expect(r.entry.nonce).toBe(0);
  });

  it('clientSeedSource recorded as system-default when player did not supply', async () => {
    const { mgr } = setup;
    const { session } = await mgr.createSession({ tenantId: 't', playerId: 'p' });
    const r = await mgr.placeRound({
      sessionId: session.id,
      gameConfig: { type: 'dice', minRoll: 0, maxRoll: 100, decimals: 2 },
    });
    expect(r.entry.clientSeedSource).toBe('system-default');
  });

  it('clientSeedSource recorded as player when player supplied', async () => {
    const { mgr } = setup;
    const { session } = await mgr.createSession({
      tenantId: 't',
      playerId: 'p',
      clientSeed: 'my-seed',
    });
    const r = await mgr.placeRound({
      sessionId: session.id,
      gameConfig: { type: 'dice', minRoll: 0, maxRoll: 100, decimals: 2 },
    });
    expect(r.entry.clientSeedSource).toBe('player');
    expect(r.entry.clientSeed).toBe('my-seed');
  });

  it('endSession rotates final seed pair and ends session', async () => {
    const { mgr, store } = setup;
    const { session } = await mgr.createSession({ tenantId: 't', playerId: 'p' });
    await mgr.placeRound({
      sessionId: session.id,
      gameConfig: { type: 'dice', minRoll: 0, maxRoll: 100, decimals: 2 },
    });
    const ended = await mgr.endSession(session.id);
    expect(ended).not.toBeNull();
    const fetched = await store.getSession(session.id);
    expect(fetched?.endedAt).not.toBeNull();
  });

  it('round log invariant: HMAC output recomputes from stored inputs', async () => {
    const { mgr } = setup;
    const { session } = await mgr.createSession({
      tenantId: 't',
      playerId: 'p',
      clientSeed: 'cs',
    });
    const r0 = await mgr.placeRound({
      sessionId: session.id,
      gameConfig: { type: 'dice', minRoll: 0, maxRoll: 100, decimals: 2 },
    });
    const rot = await mgr.rotateSeed({ sessionId: session.id, trigger: 'player-request' });
    const revealedSeed = rot.previousSeedPair.serverSeed!;
    const { hmac } = await import('@noble/hashes/hmac.js');
    const { sha256 } = await import('@noble/hashes/sha2.js');
    const { utf8ToBytes, bytesToHex } = await import('@noble/hashes/utils.js');
    const recomputed = bytesToHex(
      hmac(
        sha256,
        utf8ToBytes(revealedSeed),
        utf8ToBytes(`${r0.entry.clientSeed}:${r0.entry.nonce}:0`),
      ),
    );
    expect(recomputed).toBe(r0.entry.hmacOutput);
  });
});
