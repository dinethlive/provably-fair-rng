/**
 * @pf/seed-lifecycle — Seed Lifecycle Manager.
 *
 * Public API:
 *   - `SeedLifecycleManager`           orchestrator (createSession, placeRound, rotateSeed, ...)
 *   - `MemorySeedPairStore`            in-memory persistence
 *   - `verifyChain`, `computeEntryHash` audit-log integrity helpers
 *   - `generateServerSeed`, `generateClientSeed`, `generateId` — CSPRNG
 */

export {
  SeedLifecycleManager,
  defaultManagerOptions,
  type ManagerOptions,
} from './manager.js';
export { MemorySeedPairStore } from './store/memory.js';
export type { SeedPairStore } from './store/types.js';
export {
  computeEntryHash,
  verifyChain,
  GENESIS_HASH,
} from './hash-chain.js';
export {
  generateServerSeed,
  generateClientSeed,
  generateId,
} from './csprng.js';
export type {
  Session,
  SessionId,
  SeedPair,
  SeedPairId,
  SeedPairStatus,
  SeedPairSummary,
  RoundLogEntry,
  RoundId,
  PlayerId,
  TenantId,
  ClientSeedSource,
  RotationTrigger,
  CreateSessionInput,
  CreateSessionOutput,
  PlaceRoundInput,
  PlaceRoundOutput,
  RotateSeedInput,
  RotateSeedOutput,
  OutcomeDistributionEntry,
} from './types.js';
