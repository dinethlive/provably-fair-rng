/**
 * CSPRNG seed generation — wraps the platform's OS-level secure source.
 *
 * Per PRD Ch.4: Server Seeds must be generated using the OS CSPRNG
 * (`/dev/urandom` on Linux, `CryptGenRandom` on Windows). Node's
 * `crypto.randomBytes` delegates to these. Default seed length is 32 bytes
 * (256 bits) — the PRD's minimum entropy threshold.
 *
 * On entropy-source failure (extremely rare), `randomBytes` throws; callers
 * MUST halt new game sessions per PRD Ch.7.
 */

import { randomBytes } from 'node:crypto';

const DEFAULT_BYTES = 32;

export function generateServerSeed(byteLength = DEFAULT_BYTES): string {
  if (!Number.isInteger(byteLength) || byteLength < 32 || byteLength > 256) {
    throw new RangeError(`generateServerSeed: byteLength must be integer in [32, 256], got ${byteLength}`);
  }
  return randomBytes(byteLength).toString('hex');
}

export function generateClientSeed(byteLength = 16): string {
  if (!Number.isInteger(byteLength) || byteLength < 8 || byteLength > 64) {
    throw new RangeError(`generateClientSeed: byteLength must be integer in [8, 64], got ${byteLength}`);
  }
  return randomBytes(byteLength).toString('hex');
}

export function generateId(): string {
  const buf = randomBytes(16);
  buf[6] = (buf[6]! & 0x0f) | 0x70;
  buf[8] = (buf[8]! & 0x3f) | 0x80;
  const hex = buf.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
