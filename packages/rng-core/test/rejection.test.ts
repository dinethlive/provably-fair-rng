import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { HmacByteStream } from '../src/hmac.js';
import { uniformInt } from '../src/rejection.js';

describe('uniformInt', () => {
  it('rejects invalid ranges', () => {
    const s = new HmacByteStream('s', 'c', 0);
    expect(() => uniformInt(s, 0)).toThrow(RangeError);
    expect(() => uniformInt(s, -1)).toThrow(RangeError);
    expect(() => uniformInt(s, 1.5)).toThrow(RangeError);
    expect(() => uniformInt(s, 2 ** 32 + 1)).toThrow(RangeError);
  });

  it('output is always in [0, range)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10_000 }), fc.string({ minLength: 1, maxLength: 20 }), (range, seed) => {
        const stream = new HmacByteStream(seed, 'cli', 1);
        const { value } = uniformInt(stream, range);
        return value >= 0 && value < range;
      }),
      { numRuns: 200 },
    );
  });

  it('range = 1 always returns 0', () => {
    const stream = new HmacByteStream('s', 'c', 0);
    for (let i = 0; i < 100; i++) {
      expect(uniformInt(stream, 1).value).toBe(0);
    }
  });

  it('range = 2^32 (power of 2): no rejections expected over 1000 draws', () => {
    const stream = new HmacByteStream('s', 'c', 0);
    let totalRejections = 0;
    for (let i = 0; i < 1000; i++) {
      totalRejections += uniformInt(stream, 2 ** 32).rejections.length;
    }
    expect(totalRejections).toBe(0);
  });

  it('rejection probability for range 100 is ≪ 0.001%', () => {
    const stream = new HmacByteStream('rejection-test', 'c', 0);
    const draws = 10_000;
    let totalRejections = 0;
    for (let i = 0; i < draws; i++) {
      totalRejections += uniformInt(stream, 100).rejections.length;
    }
    const ratio = totalRejections / (draws + totalRejections);
    expect(ratio).toBeLessThan(0.001);
  });
});
