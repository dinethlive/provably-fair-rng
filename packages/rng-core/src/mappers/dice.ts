/**
 * Dice mapper — continuous range [minRoll, maxRoll] with `decimals` precision.
 *
 * Default Stake-compatible: roll is a [0.00, 99.99] number with 2 decimals.
 * Industry: player picks an over/under target; this mapper produces only the
 * roll. Win/loss settlement is the operator's concern, not the RNG core.
 */

import type { HmacByteStream } from '../hmac.js';
import type { DiceConfig, DiceResult } from '../types.js';

export function mapDice(stream: HmacByteStream, config: DiceConfig): DiceResult {
  const { minRoll, maxRoll, decimals } = config;
  if (maxRoll <= minRoll) {
    throw new RangeError(`dice config: maxRoll (${maxRoll}) must exceed minRoll (${minRoll})`);
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 8) {
    throw new RangeError(`dice config: decimals must be integer in [0, 8], got ${decimals}`);
  }

  const float = stream.nextFloat();
  const span = maxRoll - minRoll;
  const raw = minRoll + float * span;
  const factor = 10 ** decimals;
  const roll = Math.floor(raw * factor) / factor;

  return { type: 'dice', roll };
}
