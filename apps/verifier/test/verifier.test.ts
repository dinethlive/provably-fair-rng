import { describe, expect, it } from 'vitest';
import { commitmentOf, determineRound } from '@pf/rng-core';

import { verify } from '../src/lib/verifier.ts';

describe('verifier lib', () => {
  it('reproduces a recorded outcome and commitment', () => {
    const serverSeed = 'a'.repeat(64);
    const recorded = determineRound({
      serverSeed,
      clientSeed: 'cli',
      nonce: 7,
      gameConfig: { type: 'dice', minRoll: 0, maxRoll: 100, decimals: 4 },
    });
    const out = verify({
      serverSeed,
      clientSeed: 'cli',
      nonce: 7,
      gameConfig: { type: 'dice', minRoll: 0, maxRoll: 100, decimals: 4 },
      expectedCommitment: commitmentOf(serverSeed),
      expectedResult: recorded.result,
    });
    expect(out.commitmentMatches).toBe(true);
    expect(out.resultMatches).toBe(true);
  });

  it('flags commitment mismatch when a wrong server seed is provided', () => {
    const goodSeed = 'a'.repeat(64);
    const wrongSeed = 'b'.repeat(64);
    const out = verify({
      serverSeed: wrongSeed,
      clientSeed: 'cli',
      nonce: 0,
      gameConfig: { type: 'dice', minRoll: 0, maxRoll: 100, decimals: 4 },
      expectedCommitment: commitmentOf(goodSeed),
    });
    expect(out.commitmentMatches).toBe(false);
  });

  it('flags result mismatch when result was tampered', () => {
    const serverSeed = 'a'.repeat(64);
    const out = verify({
      serverSeed,
      clientSeed: 'cli',
      nonce: 0,
      gameConfig: { type: 'dice', minRoll: 0, maxRoll: 100, decimals: 4 },
      expectedResult: { type: 'dice', roll: 999.999 },
    });
    expect(out.resultMatches).toBe(false);
  });
});
