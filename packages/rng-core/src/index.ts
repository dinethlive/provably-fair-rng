/**
 * @pf/rng-core — Provably Fair RNG library.
 *
 * Public API:
 *   - `determineRound(input)`         high-level: produces a game outcome from inputs
 *   - `HmacByteStream`                 low-level: deterministic 4-byte segment generator
 *   - `uniformInt(stream, range)`      rejection-sampled integer in [0, range)
 *   - `commitmentOf(serverSeed)`       SHA-256(serverSeed) — pre-game commitment
 *   - `verifyCommitment(seed, commit)` constant-time commitment check
 *
 * Game configs and result types are exported from `./types`.
 */

export { HmacByteStream } from './hmac.js';
export type { HashRecord, ByteStreamState } from './hmac.js';
export { uniformInt } from './rejection.js';
export type { UniformSample } from './rejection.js';
export { commitmentOf, verifyCommitment } from './commitment.js';
export {
  determineRound,
  mapByConfig,
  mapDice,
  mapCrash,
  mapCards,
  mapSlot,
} from './mappers/index.js';
export type {
  ServerSeed,
  ClientSeed,
  Nonce,
  Cursor,
  GameType,
  GameConfig,
  DiceConfig,
  CrashConfig,
  CardsConfig,
  SlotConfig,
  GameResult,
  DiceResult,
  CrashResult,
  CardsResult,
  SlotResult,
  Card,
  HmacInputs,
  RejectionRecord,
  RoundInput,
  RoundOutput,
} from './types.js';
