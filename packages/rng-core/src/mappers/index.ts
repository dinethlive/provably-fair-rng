/**
 * Mapper dispatch — routes a `GameConfig` to its mapper.
 */

import { HmacByteStream } from '../hmac.js';
import type { GameConfig, GameResult, RoundInput, RoundOutput } from '../types.js';
import { mapCards } from './cards.js';
import { mapCrash } from './crash.js';
import { mapDice } from './dice.js';
import { mapSlot } from './slot.js';

export function mapByConfig(stream: HmacByteStream, config: GameConfig): GameResult {
  switch (config.type) {
    case 'dice':
      return mapDice(stream, config);
    case 'crash':
      return mapCrash(stream, config);
    case 'cards':
      return mapCards(stream, config);
    case 'slot':
      return mapSlot(stream, config);
  }
}

export function determineRound(input: RoundInput): RoundOutput {
  const stream = new HmacByteStream(input.serverSeed, input.clientSeed, input.nonce);
  const result = mapByConfig(stream, input.gameConfig);
  const state = stream.getState();

  return {
    hashes: state.hashes,
    rejections: [],
    cursorUsed: state.cursorUsed,
    result,
  };
}

export { mapDice, mapCrash, mapCards, mapSlot };
