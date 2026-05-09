import { describe, expect, it } from 'vitest';

import { HmacByteStream } from '../src/hmac.js';
import { mapCards } from '../src/mappers/cards.js';
import { mapCrash } from '../src/mappers/crash.js';
import { mapDice } from '../src/mappers/dice.js';
import { mapSlot } from '../src/mappers/slot.js';
import type { Card } from '../src/types.js';

const dice = (rolls: { decimals?: number; min?: number; max?: number } = {}) => ({
  type: 'dice' as const,
  minRoll: rolls.min ?? 0,
  maxRoll: rolls.max ?? 100,
  decimals: rolls.decimals ?? 2,
});

describe('mapDice', () => {
  it('roll is in [minRoll, maxRoll) at the requested precision', () => {
    for (let n = 0; n < 100; n++) {
      const stream = new HmacByteStream('s', 'c', n);
      const { roll } = mapDice(stream, dice({ min: 0, max: 100, decimals: 2 }));
      expect(roll).toBeGreaterThanOrEqual(0);
      expect(roll).toBeLessThan(100);
      expect(Number((roll * 100).toFixed(0))).toBe(Math.round(roll * 100));
    }
  });

  it('rejects invalid configs', () => {
    const stream = new HmacByteStream('s', 'c', 0);
    expect(() => mapDice(stream, dice({ min: 10, max: 5 }))).toThrow(RangeError);
    expect(() => mapDice(stream, dice({ decimals: -1 }))).toThrow(RangeError);
    expect(() => mapDice(stream, dice({ decimals: 99 }))).toThrow(RangeError);
  });

  it('determinism: same inputs produce same roll', () => {
    const a = mapDice(new HmacByteStream('s', 'c', 1), dice());
    const b = mapDice(new HmacByteStream('s', 'c', 1), dice());
    expect(a.roll).toBe(b.roll);
  });
});

describe('mapCrash', () => {
  it('multiplier is always >= 1.00', () => {
    for (let n = 0; n < 1000; n++) {
      const stream = new HmacByteStream('s', 'c', n);
      const { multiplier } = mapCrash(stream, { type: 'crash' });
      expect(multiplier).toBeGreaterThanOrEqual(1);
    }
  });

  it('default config: ~1% multiplier=1.00 floor effect (99% RTP by formula)', () => {
    let busts = 0;
    const N = 50_000;
    for (let n = 0; n < N; n++) {
      const stream = new HmacByteStream('crash-stat', 'c', n);
      const { multiplier } = mapCrash(stream, { type: 'crash' });
      if (multiplier === 1) busts++;
    }
    const rate = busts / N;
    expect(rate).toBeGreaterThan(0.005);
    expect(rate).toBeLessThan(0.015);
  });

  it('instantBustDivisor=33: ~3% additional bust rate (~4% total with formula)', () => {
    let busts = 0;
    const N = 50_000;
    for (let n = 0; n < N; n++) {
      const stream = new HmacByteStream('crash-stat-bust', 'c', n);
      const { multiplier } = mapCrash(stream, { type: 'crash', instantBustDivisor: 33 });
      if (multiplier === 1) busts++;
    }
    const rate = busts / N;
    expect(rate).toBeGreaterThan(0.03);
    expect(rate).toBeLessThan(0.05);
  });

  it('rejects invalid instantBustDivisor', () => {
    const stream = new HmacByteStream('s', 'c', 0);
    expect(() => mapCrash(stream, { type: 'crash', instantBustDivisor: 0 })).toThrow(RangeError);
    expect(() => mapCrash(stream, { type: 'crash', instantBustDivisor: 1 })).toThrow(RangeError);
    expect(() => mapCrash(stream, { type: 'crash', instantBustDivisor: 1.5 })).toThrow(RangeError);
  });
});

describe('mapCards', () => {
  it('produces 52 unique cards for a single deck', () => {
    const stream = new HmacByteStream('s', 'c', 0);
    const { deck } = mapCards(stream, { type: 'cards', deckCount: 1 });
    expect(deck).toHaveLength(52);
    const ids = new Set(deck.map((c) => `${c.suit}-${c.value}`));
    expect(ids.size).toBe(52);
  });

  it('produces 104 cards for two decks (each card appears exactly twice)', () => {
    const stream = new HmacByteStream('s', 'c', 0);
    const { deck } = mapCards(stream, { type: 'cards', deckCount: 2 });
    expect(deck).toHaveLength(104);
    const counts = new Map<string, number>();
    for (const c of deck) {
      const key = `${c.suit}-${c.value}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const v of counts.values()) expect(v).toBe(2);
  });

  it('determinism: same inputs produce same shuffle', () => {
    const a = mapCards(new HmacByteStream('s', 'c', 1), { type: 'cards', deckCount: 1 });
    const b = mapCards(new HmacByteStream('s', 'c', 1), { type: 'cards', deckCount: 1 });
    const aIds = a.deck.map((c: Card) => `${c.suit}-${c.value}`);
    const bIds = b.deck.map((c: Card) => `${c.suit}-${c.value}`);
    expect(aIds).toEqual(bIds);
  });

  it('different nonce produces different shuffle (high probability)', () => {
    const a = mapCards(new HmacByteStream('s', 'c', 1), { type: 'cards', deckCount: 1 });
    const b = mapCards(new HmacByteStream('s', 'c', 2), { type: 'cards', deckCount: 1 });
    const aIds = a.deck.map((c: Card) => `${c.suit}-${c.value}`).join(',');
    const bIds = b.deck.map((c: Card) => `${c.suit}-${c.value}`).join(',');
    expect(aIds).not.toEqual(bIds);
  });
});

describe('mapSlot', () => {
  const config = {
    type: 'slot' as const,
    reels: 5,
    rows: 3,
    symbols: [
      { id: 'wild', weight: 1 },
      { id: 'scatter', weight: 2 },
      { id: 'high1', weight: 5 },
      { id: 'high2', weight: 5 },
      { id: 'low1', weight: 10 },
      { id: 'low2', weight: 10 },
    ],
  };

  it('produces a 5x3 grid of valid symbols', () => {
    const stream = new HmacByteStream('s', 'c', 0);
    const { grid } = mapSlot(stream, config);
    expect(grid).toHaveLength(5);
    const validIds = new Set(config.symbols.map((s) => s.id));
    for (const col of grid) {
      expect(col).toHaveLength(3);
      for (const sym of col) expect(validIds.has(sym)).toBe(true);
    }
  });

  it('rejects invalid configs', () => {
    const stream = new HmacByteStream('s', 'c', 0);
    expect(() => mapSlot(stream, { ...config, reels: 0 })).toThrow(RangeError);
    expect(() => mapSlot(stream, { ...config, rows: 99 })).toThrow(RangeError);
    expect(() =>
      mapSlot(stream, { ...config, symbols: [{ id: 'x', weight: 0 }] }),
    ).toThrow(RangeError);
    expect(() => mapSlot(stream, { ...config, symbols: [] })).toThrow(RangeError);
  });
});
