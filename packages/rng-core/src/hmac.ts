/**
 * HMAC-SHA256 byte stream — the cryptographic primitive feeding every mapper.
 *
 * Construction (verified against Stake's open-source verifier
 * `Utils/GameSeedUtils.js`, May 2026):
 *
 *   key      = serverSeed                              (HMAC key, raw UTF-8 bytes)
 *   message  = `${clientSeed}:${nonce}:${cursor}`      (HMAC message, raw UTF-8 bytes)
 *   digest   = HMAC-SHA256(key, message)               (32 bytes)
 *
 * The 32-byte digest is consumed in 8 contiguous 4-byte segments. When all
 * 8 segments are drawn, `cursor` increments by 1 and a fresh HMAC is computed
 * with the new message string. `nonce` is constant for an entire round.
 *
 * Cursor semantics resolution: see Project1_PRD_GAPS.md §A1.
 */

import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

import type { ClientSeed, Cursor, Nonce, ServerSeed } from './types.js';

const SEGMENT_SIZE = 4;
const SEGMENTS_PER_HASH = 8;

export interface HashRecord {
  readonly cursor: Cursor;
  readonly hex: string;
}

export interface ByteStreamState {
  readonly hashes: ReadonlyArray<HashRecord>;
  readonly cursorUsed: Cursor;
  readonly segmentsConsumed: number;
}

export class HmacByteStream {
  private readonly serverSeedKey: Uint8Array;
  private readonly clientSeed: ClientSeed;
  private readonly nonce: Nonce;

  private cursor: Cursor;
  private buffer: Uint8Array;
  private offset: number;

  private readonly hashLog: HashRecord[];
  private segmentsConsumed: number;

  constructor(serverSeed: ServerSeed, clientSeed: ClientSeed, nonce: Nonce) {
    this.serverSeedKey = utf8ToBytes(serverSeed);
    this.clientSeed = clientSeed;
    this.nonce = nonce;

    this.cursor = 0;
    this.hashLog = [];
    this.segmentsConsumed = 0;

    this.buffer = this.computeHash(this.cursor);
    this.offset = 0;
  }

  private computeHash(cursor: Cursor): Uint8Array {
    const message = utf8ToBytes(`${this.clientSeed}:${this.nonce}:${cursor}`);
    const digest = hmac(sha256, this.serverSeedKey, message);
    this.hashLog.push({ cursor, hex: bytesToHex(digest) });
    return digest;
  }

  /**
   * Pull the next 4-byte segment as a uint32 big-endian.
   * Advances the internal pointer; recomputes HMAC with cursor+1 when exhausted.
   */
  nextUint32(): number {
    if (this.offset + SEGMENT_SIZE > this.buffer.length) {
      this.cursor += 1;
      this.buffer = this.computeHash(this.cursor);
      this.offset = 0;
    }
    const b0 = this.buffer[this.offset]!;
    const b1 = this.buffer[this.offset + 1]!;
    const b2 = this.buffer[this.offset + 2]!;
    const b3 = this.buffer[this.offset + 3]!;
    this.offset += SEGMENT_SIZE;
    this.segmentsConsumed += 1;

    return ((b0 << 24) >>> 0) + (b1 << 16) + (b2 << 8) + b3;
  }

  /**
   * Pull the next 4-byte segment as a [0, 1) float using Stake-compatible
   * Horner sum: `b0/256 + b1/256² + b2/256³ + b3/256⁴`.
   *
   * Stays in IEEE-754 double-precision range without 32-bit overflow.
   */
  nextFloat(): number {
    if (this.offset + SEGMENT_SIZE > this.buffer.length) {
      this.cursor += 1;
      this.buffer = this.computeHash(this.cursor);
      this.offset = 0;
    }
    let value = 0;
    for (let i = 0; i < SEGMENT_SIZE; i++) {
      const byte = this.buffer[this.offset + i]!;
      value += byte / 256 ** (i + 1);
    }
    this.offset += SEGMENT_SIZE;
    this.segmentsConsumed += 1;
    return value;
  }

  /** Snapshot of consumed cursors and segments for audit logging. */
  getState(): ByteStreamState {
    return {
      hashes: [...this.hashLog],
      cursorUsed: this.cursor,
      segmentsConsumed: this.segmentsConsumed,
    };
  }
}

export const _internal = { SEGMENT_SIZE, SEGMENTS_PER_HASH };
