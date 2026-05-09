/**
 * Cards mapper — Stake-compatible partial Fisher-Yates shuffle.
 *
 * For an n-card deck, draw n-1 floats; for the i-th draw (i = n-1, n-2, ..., 1),
 * compute `index = floor(float * (i+1))` and swap deck[i] with deck[index].
 * Result is a uniform random permutation. Resolution: GAPS.md §A4.
 *
 * Single 52-card deck by default; multi-deck shoes via `deckCount`.
 */

import type { HmacByteStream } from '../hmac.js';
import type { Card, CardsConfig, CardsResult } from '../types.js';

const SUITS: ReadonlyArray<Card['suit']> = ['hearts', 'diamonds', 'clubs', 'spades'];
const VALUES: ReadonlyArray<Card['value']> = [
  'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K',
];

function buildDeck(deckCount: number): Card[] {
  const deck: Card[] = [];
  for (let d = 0; d < deckCount; d++) {
    for (const suit of SUITS) {
      for (const value of VALUES) {
        deck.push({ suit, value });
      }
    }
  }
  return deck;
}

export function mapCards(stream: HmacByteStream, config: CardsConfig): CardsResult {
  const { deckCount } = config;
  if (!Number.isInteger(deckCount) || deckCount < 1 || deckCount > 8) {
    throw new RangeError(`cards config: deckCount must be integer in [1, 8], got ${deckCount}`);
  }

  const deck = buildDeck(deckCount);
  const n = deck.length;

  for (let i = n - 1; i >= 1; i--) {
    const float = stream.nextFloat();
    const j = Math.floor(float * (i + 1));
    const tmp = deck[i]!;
    deck[i] = deck[j]!;
    deck[j] = tmp;
  }

  return { type: 'cards', deck };
}
