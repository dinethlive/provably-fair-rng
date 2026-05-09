/**
 * Slot mapper — virtual-reel (GLI-11 standard) weighted symbol selection.
 *
 * The PRD requires "explicitly defined, non-uniform probability weights." The
 * industry standard (Stake `Slots.js`, GLI-11 §3.3) realizes weights via virtual
 * reels: a flat array where each symbol appears `weight` times, then uniform
 * selection. We expose explicit `{ id, weight }` configuration and build the
 * virtual reel internally — players see semantic weights, the engine produces
 * the GLI-11-validated distribution.
 */

import { uniformInt } from '../rejection.js';
import type { HmacByteStream } from '../hmac.js';
import type { SlotConfig, SlotResult } from '../types.js';

interface VirtualReel {
  readonly symbols: ReadonlyArray<string>;
  readonly length: number;
}

function buildVirtualReel(config: SlotConfig): VirtualReel {
  const symbols: string[] = [];
  for (const { id, weight } of config.symbols) {
    if (!Number.isInteger(weight) || weight < 1) {
      throw new RangeError(`slot config: symbol "${id}" weight must be positive integer`);
    }
    for (let i = 0; i < weight; i++) symbols.push(id);
  }
  if (symbols.length === 0) {
    throw new RangeError('slot config: at least one symbol with positive weight required');
  }
  return { symbols, length: symbols.length };
}

export function mapSlot(stream: HmacByteStream, config: SlotConfig): SlotResult {
  const { reels, rows } = config;
  if (!Number.isInteger(reels) || reels < 1 || reels > 10) {
    throw new RangeError(`slot config: reels must be integer in [1, 10], got ${reels}`);
  }
  if (!Number.isInteger(rows) || rows < 1 || rows > 10) {
    throw new RangeError(`slot config: rows must be integer in [1, 10], got ${rows}`);
  }

  const virtualReel = buildVirtualReel(config);
  const grid: string[][] = [];

  for (let r = 0; r < reels; r++) {
    const column: string[] = [];
    for (let row = 0; row < rows; row++) {
      const { value } = uniformInt(stream, virtualReel.length);
      column.push(virtualReel.symbols[value]!);
    }
    grid.push(column);
  }

  return { type: 'slot', grid };
}
