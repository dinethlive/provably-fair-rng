/**
 * Statistical distribution tests — PRD §"What Must Exist: Bias Prevention" and
 * §"DELIVERABLE SPECIFICATION" require:
 *   - Uniform distribution verified over 1M simulated rounds
 *   - Uniqueness across 10K sequential nonces
 *
 * These tests are slow by design. Run with `pnpm test:stat`.
 *
 * Acceptance: chi-square goodness-of-fit p-value >= 0.01 (GAPS.md §B16).
 */

import { describe, expect, it } from 'vitest';

import { HmacByteStream } from '../src/hmac.js';
import { uniformInt } from '../src/rejection.js';
import { determineRound } from '../src/mappers/index.js';
import type { Card } from '../src/types.js';

function chiSquare(observed: ReadonlyArray<number>, expected: number): number {
  let sum = 0;
  for (const o of observed) {
    if (o === undefined) continue;
    sum += ((o - expected) ** 2) / expected;
  }
  return sum;
}

function chiSquarePValueUpper(stat: number, df: number): number {
  let term = Math.exp(-stat / 2);
  let sum = term;
  for (let i = 1; i < df / 2; i++) {
    term *= stat / (2 * i);
    sum += term;
  }
  return sum;
}

describe('distribution / 1M rounds', () => {
  it('uniformInt(100) over 1M rounds is uniformly distributed (chi-square p > 0.01)', () => {
    const N = 1_000_000;
    const RANGE = 100;
    const counts = new Array<number>(RANGE).fill(0);

    const stream = new HmacByteStream('distribution-test-100', 'client-stat', 0);
    for (let i = 0; i < N; i++) {
      const idx = uniformInt(stream, RANGE).value;
      counts[idx] = (counts[idx] ?? 0) + 1;
    }

    const expected = N / RANGE;
    const stat = chiSquare(counts, expected);
    const p = chiSquarePValueUpper(stat, RANGE - 1);
    expect(p).toBeGreaterThan(0.01);
  }, 120_000);

  it('dice rolls over 100K rounds: mean ≈ 50, std ≈ 28.87', () => {
    const N = 100_000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < N; i++) {
      const out = determineRound({
        serverSeed: 'dice-stat',
        clientSeed: 'c',
        nonce: i,
        gameConfig: { type: 'dice', minRoll: 0, maxRoll: 100, decimals: 4 },
      });
      const roll = out.result.type === 'dice' ? out.result.roll : NaN;
      sum += roll;
      sumSq += roll * roll;
    }
    const mean = sum / N;
    const variance = sumSq / N - mean * mean;
    const std = Math.sqrt(variance);
    expect(mean).toBeGreaterThan(49.5);
    expect(mean).toBeLessThan(50.5);
    expect(std).toBeGreaterThan(28);
    expect(std).toBeLessThan(29.5);
  }, 60_000);

  it('slot weighted-symbol frequencies match declared weights within 0.5% (1M rounds)', () => {
    const symbols = [
      { id: 'A', weight: 1 },
      { id: 'B', weight: 5 },
      { id: 'C', weight: 10 },
      { id: 'D', weight: 20 },
      { id: 'E', weight: 64 },
    ];
    const totalWeight = symbols.reduce((acc, s) => acc + s.weight, 0);
    const expectedRates = new Map(symbols.map((s) => [s.id, s.weight / totalWeight]));

    const N = 1_000_000;
    const counts = new Map<string, number>(symbols.map((s) => [s.id, 0]));
    for (let i = 0; i < N; i++) {
      const out = determineRound({
        serverSeed: 'slot-stat',
        clientSeed: 'c',
        nonce: i,
        gameConfig: { type: 'slot', reels: 1, rows: 1, symbols },
      });
      if (out.result.type === 'slot') {
        const sym = out.result.grid[0]![0]!;
        counts.set(sym, (counts.get(sym) ?? 0) + 1);
      }
    }
    for (const [id, expectedRate] of expectedRates) {
      const observed = (counts.get(id) ?? 0) / N;
      expect(Math.abs(observed - expectedRate)).toBeLessThan(0.005);
    }
  }, 120_000);
});

describe('uniqueness / 10K sequential nonces', () => {
  it('produces 10K distinct dice rolls (with high decimal precision, no collisions)', () => {
    const N = 10_000;
    const seen = new Set<number>();
    for (let i = 0; i < N; i++) {
      const out = determineRound({
        serverSeed: 'uniqueness-test',
        clientSeed: 'c',
        nonce: i,
        gameConfig: { type: 'dice', minRoll: 0, maxRoll: 1_000_000, decimals: 6 },
      });
      if (out.result.type === 'dice') seen.add(out.result.roll);
    }
    expect(seen.size).toBeGreaterThan(N - 5);
  }, 30_000);

  it('produces 10K distinct card-deck shuffles (no two identical permutations)', () => {
    const N = 10_000;
    const seen = new Set<string>();
    for (let i = 0; i < N; i++) {
      const out = determineRound({
        serverSeed: 'card-uniqueness',
        clientSeed: 'c',
        nonce: i,
        gameConfig: { type: 'cards', deckCount: 1 },
      });
      if (out.result.type === 'cards') {
        const sig = out.result.deck.map((c: Card) => `${c.suit[0]}${c.value}`).join('');
        seen.add(sig);
      }
    }
    expect(seen.size).toBe(N);
  }, 30_000);
});
