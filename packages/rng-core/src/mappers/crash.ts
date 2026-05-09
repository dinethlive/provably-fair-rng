/**
 * Crash mapper — produces a bust multiplier ≥ 1.00.
 *
 * Stake-compatible formula (verified May 2026):
 *   1. Pull uint32 `u`.
 *   2. If `instantBustDivisor` is set and `u % instantBustDivisor === 0` →
 *      explicit bust (multiplier = 1.00).
 *   3. Else multiplier = floor((100 * 2^32 - u) / (2^32 - u)) / 100.
 *
 * The formula has a NATURAL ~1% multiplier=1.00 floor effect: for u ∈ [0, e/100)
 * the raw result is in [100, 101), so floor(raw)/100 = 1.00. This produces
 * 99% RTP by construction. Setting `instantBustDivisor` adds an explicit bust
 * probability ON TOP of the natural 1%.
 *
 * For most operators the natural 99% RTP is sufficient; `instantBustDivisor`
 * is exposed for tenants who require a higher house edge.
 */

import type { HmacByteStream } from '../hmac.js';
import type { CrashConfig, CrashResult } from '../types.js';

export function mapCrash(stream: HmacByteStream, config: CrashConfig): CrashResult {
  const { instantBustDivisor } = config;
  if (instantBustDivisor !== undefined) {
    if (
      !Number.isInteger(instantBustDivisor) ||
      instantBustDivisor < 2 ||
      instantBustDivisor > 1_000_000
    ) {
      throw new RangeError(
        `crash config: instantBustDivisor must be integer in [2, 1_000_000], got ${instantBustDivisor}`,
      );
    }
  }

  const u = stream.nextUint32();
  if (instantBustDivisor !== undefined && u % instantBustDivisor === 0) {
    return { type: 'crash', multiplier: 1.0 };
  }

  const e = 2 ** 32;
  const raw = (100 * e - u) / (e - u);
  const multiplier = Math.max(1.0, Math.floor(raw) / 100);
  return { type: 'crash', multiplier };
}
