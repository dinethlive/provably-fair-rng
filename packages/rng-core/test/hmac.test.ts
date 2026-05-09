import { describe, expect, it } from 'vitest';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

import { HmacByteStream } from '../src/hmac.js';

describe('HmacByteStream', () => {
  it('first 4 bytes equal the leading 4 bytes of HMAC-SHA256(server, "client:nonce:0")', () => {
    const serverSeed = 'a'.repeat(64);
    const clientSeed = 'player-seed';
    const nonce = 7;
    const expected = bytesToHex(
      hmac(sha256, utf8ToBytes(serverSeed), utf8ToBytes(`${clientSeed}:${nonce}:0`)),
    );

    const stream = new HmacByteStream(serverSeed, clientSeed, nonce);
    const u = stream.nextUint32();
    const expectedFirst4 = parseInt(expected.substring(0, 8), 16);
    expect(u).toBe(expectedFirst4);
  });

  it('produces identical output for identical inputs (determinism)', () => {
    const a = new HmacByteStream('seed', 'client', 1);
    const b = new HmacByteStream('seed', 'client', 1);
    const arr1 = Array.from({ length: 16 }, () => a.nextUint32());
    const arr2 = Array.from({ length: 16 }, () => b.nextUint32());
    expect(arr1).toEqual(arr2);
  });

  it('rolls cursor to 1 on the 9th uint32 draw (8 segments per hash)', () => {
    const stream = new HmacByteStream('s', 'c', 0);
    for (let i = 0; i < 8; i++) stream.nextUint32();
    expect(stream.getState().cursorUsed).toBe(0);
    stream.nextUint32();
    expect(stream.getState().cursorUsed).toBe(1);
  });

  it('logs each computed HMAC with its cursor', () => {
    const stream = new HmacByteStream('s', 'c', 0);
    for (let i = 0; i < 17; i++) stream.nextUint32();
    const state = stream.getState();
    expect(state.hashes.map((h) => h.cursor)).toEqual([0, 1, 2]);
    expect(state.hashes.every((h) => /^[0-9a-f]{64}$/.test(h.hex))).toBe(true);
  });

  it('nextFloat is in [0, 1)', () => {
    const stream = new HmacByteStream('s', 'c', 0);
    for (let i = 0; i < 1000; i++) {
      const f = stream.nextFloat();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it('nextFloat matches Stake Horner-sum reference implementation', () => {
    const serverSeed = 'srv';
    const clientSeed = 'cli';
    const nonce = 42;
    const digestHex = bytesToHex(
      hmac(sha256, utf8ToBytes(serverSeed), utf8ToBytes(`${clientSeed}:${nonce}:0`)),
    );
    const b0 = parseInt(digestHex.substring(0, 2), 16);
    const b1 = parseInt(digestHex.substring(2, 4), 16);
    const b2 = parseInt(digestHex.substring(4, 6), 16);
    const b3 = parseInt(digestHex.substring(6, 8), 16);
    const reference = b0 / 256 + b1 / 256 ** 2 + b2 / 256 ** 3 + b3 / 256 ** 4;

    const stream = new HmacByteStream(serverSeed, clientSeed, nonce);
    expect(stream.nextFloat()).toBe(reference);
  });

  it('cursor as message input: HMAC at cursor=1 differs from cursor=0', () => {
    const a = bytesToHex(hmac(sha256, utf8ToBytes('s'), utf8ToBytes('c:0:0')));
    const b = bytesToHex(hmac(sha256, utf8ToBytes('s'), utf8ToBytes('c:0:1')));
    expect(a).not.toEqual(b);
  });
});
