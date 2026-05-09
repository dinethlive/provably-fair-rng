/**
 * Rejection sampling utilities.
 *
 * For target range R and segment width 4 bytes (uint32):
 *   MAX_VALID = floor(2^32 / R) * R
 *   accept if `drawn < MAX_VALID`, then output `drawn % R`
 *
 * This produces an exactly uniform distribution over [0, R) with no modulo
 * bias. Resolution: Project1_PRD_GAPS.md §A3.
 */

import type { HmacByteStream } from './hmac.js';
import type { RejectionRecord } from './types.js';

const MAX_UINT32 = 0x1_0000_0000; // 2^32

export interface UniformSample {
  readonly value: number;
  readonly rejections: ReadonlyArray<RejectionRecord>;
}

/**
 * Draw a uniform integer in `[0, range)` from the byte stream using
 * uint32-level rejection sampling. `range` must be in `[1, 2^32]`.
 */
export function uniformInt(stream: HmacByteStream, range: number): UniformSample {
  if (!Number.isInteger(range) || range < 1 || range > MAX_UINT32) {
    throw new RangeError(`uniformInt: range must be integer in [1, 2^32], got ${range}`);
  }

  const maxValid = Math.floor(MAX_UINT32 / range) * range;
  const rejections: RejectionRecord[] = [];

  while (true) {
    const stateBefore = stream.getState();
    const drawn = stream.nextUint32();
    if (drawn < maxValid) {
      return { value: drawn % range, rejections };
    }
    rejections.push({
      cursor: stateBefore.cursorUsed,
      segmentIndex: stateBefore.segmentsConsumed,
      drawnValue: drawn.toString(16).padStart(8, '0'),
    });
  }
}
