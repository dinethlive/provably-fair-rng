import { describe, expect, it } from 'vitest';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

import { commitmentOf, verifyCommitment } from '../src/commitment.js';

describe('commitment', () => {
  it('commitmentOf returns SHA-256 of the server seed (UTF-8)', () => {
    const seed = 'abc123';
    const expected = bytesToHex(sha256(utf8ToBytes(seed)));
    expect(commitmentOf(seed)).toBe(expected);
  });

  it('commitment is 64 hex chars', () => {
    expect(commitmentOf('any-seed')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('verifyCommitment accepts a valid commitment', () => {
    const seed = 'server-seed-12345';
    expect(verifyCommitment(seed, commitmentOf(seed))).toBe(true);
  });

  it('verifyCommitment is case-insensitive on the commitment', () => {
    const seed = 's';
    const upper = commitmentOf(seed).toUpperCase();
    expect(verifyCommitment(seed, upper)).toBe(true);
  });

  it('verifyCommitment rejects a tampered seed', () => {
    const seed = 's';
    const commitment = commitmentOf(seed);
    expect(verifyCommitment(`${seed}!`, commitment)).toBe(false);
  });

  it('verifyCommitment rejects a tampered commitment', () => {
    const seed = 's';
    const commitment = commitmentOf(seed);
    expect(verifyCommitment(seed, commitment.replace('a', 'b'))).toBe(false);
  });
});
