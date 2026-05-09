/**
 * Pre-game commitment: SHA-256(serverSeed) — the player's verifiable bind.
 *
 * Per PRD Ch.3, the commitment is the SHA-256 hash of the Server Seed (NOT
 * an HMAC). It is published before any round is played; after revelation, the
 * player verifies SHA-256(revealedServerSeed) === commitment.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

import type { ServerSeed } from './types.js';

export function commitmentOf(serverSeed: ServerSeed): string {
  return bytesToHex(sha256(utf8ToBytes(serverSeed)));
}

export function verifyCommitment(serverSeed: ServerSeed, commitment: string): boolean {
  const expected = commitmentOf(serverSeed);
  return constantTimeEqual(expected, commitment.toLowerCase());
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
