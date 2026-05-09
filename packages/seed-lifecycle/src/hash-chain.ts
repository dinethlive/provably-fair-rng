/**
 * Round-log hash chain — tamper-evident audit chain (GAPS.md §B4).
 *
 * Each entry's `entryHash = SHA256(prevHash || canonicalEntryJSON)`. Verifying
 * a chain involves recomputing each entry's hash from its predecessor.
 * Any modification to a historical entry invalidates the chain from that
 * point forward, providing cryptographic tamper-evidence on top of the
 * DB-level append-only constraint.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

import type { RoundLogEntry } from './types.js';

export const GENESIS_HASH = '0'.repeat(64);

type ChainSubset = Omit<RoundLogEntry, 'entryHash'>;

function canonicalize(entry: ChainSubset): string {
  return JSON.stringify(entry, Object.keys(entry).sort());
}

export function computeEntryHash(entry: ChainSubset): string {
  return bytesToHex(sha256(utf8ToBytes(canonicalize(entry))));
}

export function verifyChain(entries: ReadonlyArray<RoundLogEntry>): {
  valid: boolean;
  brokenAtNonce: number | null;
} {
  let prev = GENESIS_HASH;
  for (const entry of entries) {
    if (entry.prevHash !== prev) {
      return { valid: false, brokenAtNonce: entry.nonce };
    }
    const { entryHash: _ignored, ...rest } = entry;
    void _ignored;
    const recomputed = computeEntryHash(rest);
    if (recomputed !== entry.entryHash) {
      return { valid: false, brokenAtNonce: entry.nonce };
    }
    prev = entry.entryHash;
  }
  return { valid: true, brokenAtNonce: null };
}
