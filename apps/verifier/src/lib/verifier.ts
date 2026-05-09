/**
 * Browser-side verification, re-executes the RNG core on the user's machine
 * to independently reproduce a recorded outcome. Imports the same library
 * the operator's service uses; @noble/hashes is isomorphic.
 *
 * The "Step Trace" returned here contains every intermediate value an auditor
 * needs to follow the computation by hand.
 */

import {
  HmacByteStream,
  commitmentOf,
  determineRound,
  type GameConfig,
  type GameResult,
  type RoundOutput,
} from '@pf/rng-core';

export interface VerifyInput {
  readonly serverSeed: string;
  readonly clientSeed: string;
  readonly nonce: number;
  readonly gameConfig: GameConfig;
  readonly expectedCommitment?: string | null;
  readonly expectedResult?: GameResult | null;
}

export interface StepTrace {
  readonly hashes: ReadonlyArray<{ readonly cursor: number; readonly hex: string }>;
  readonly cursorUsed: number;
  readonly hmacInputs: { serverSeed: string; clientSeed: string; nonce: number; cursor: number };
  readonly result: GameResult;
}

export interface VerifyOutput {
  readonly trace: StepTrace;
  readonly commitment: string;
  readonly commitmentMatches: boolean | null;
  readonly resultMatches: boolean | null;
  readonly raw: RoundOutput;
}

export function verify(input: VerifyInput): VerifyOutput {
  const stream = new HmacByteStream(input.serverSeed, input.clientSeed, input.nonce);
  const out = determineRound({
    serverSeed: input.serverSeed,
    clientSeed: input.clientSeed,
    nonce: input.nonce,
    gameConfig: input.gameConfig,
  });
  void stream;

  const commitment = commitmentOf(input.serverSeed);
  const commitmentMatches =
    input.expectedCommitment == null
      ? null
      : commitment.toLowerCase() === input.expectedCommitment.toLowerCase();
  const resultMatches =
    input.expectedResult == null ? null : deepEqualResult(out.result, input.expectedResult);

  const trace: StepTrace = {
    hashes: out.hashes,
    cursorUsed: out.cursorUsed,
    hmacInputs: {
      serverSeed: input.serverSeed,
      clientSeed: input.clientSeed,
      nonce: input.nonce,
      cursor: 0,
    },
    result: out.result,
  };

  return { trace, commitment, commitmentMatches, resultMatches, raw: out };
}

function deepEqualResult(a: GameResult, b: GameResult): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'dice' && b.type === 'dice') return a.roll === b.roll;
  if (a.type === 'crash' && b.type === 'crash') return a.multiplier === b.multiplier;
  if (a.type === 'cards' && b.type === 'cards') {
    if (a.deck.length !== b.deck.length) return false;
    return a.deck.every(
      (c, i) => b.deck[i]?.suit === c.suit && b.deck[i]?.value === c.value,
    );
  }
  if (a.type === 'slot' && b.type === 'slot') {
    if (a.grid.length !== b.grid.length) return false;
    return a.grid.every(
      (col, i) =>
        col.length === b.grid[i]?.length &&
        col.every((s, j) => s === b.grid[i]?.[j]),
    );
  }
  return false;
}
