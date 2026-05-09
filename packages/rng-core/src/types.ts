/**
 * Core types for the Provably Fair RNG engine.
 *
 * Source-of-truth definitions used across mappers, the seed-lifecycle service,
 * and the verification UI. Keep this file dependency-free.
 */

export type ServerSeed = string;
export type ClientSeed = string;
export type Nonce = number;
export type Cursor = number;

export type GameType = 'dice' | 'crash' | 'cards' | 'slot';

export interface HmacInputs {
  readonly serverSeed: ServerSeed;
  readonly clientSeed: ClientSeed;
  readonly nonce: Nonce;
  readonly cursor: Cursor;
}

export interface RejectionRecord {
  readonly cursor: Cursor;
  readonly segmentIndex: number;
  readonly drawnValue: string;
}

export interface DiceConfig {
  readonly type: 'dice';
  readonly minRoll: number;
  readonly maxRoll: number;
  readonly decimals: number;
}

export interface CrashConfig {
  readonly type: 'crash';
  /**
   * Optional explicit instant-bust divisor. When set, the round busts when
   * `u % instantBustDivisor === 0`. Default `undefined` (no extra explicit
   * bust — Stake's standard formula has a natural ~1% multiplier=1 floor
   * effect that yields a 99% RTP by construction).
   *
   * Stake's published default is 33 → ~3.03% additional bust rate.
   */
  readonly instantBustDivisor?: number;
}

export interface CardsConfig {
  readonly type: 'cards';
  readonly deckCount: number;
}

export interface SlotConfig {
  readonly type: 'slot';
  readonly reels: number;
  readonly rows: number;
  readonly symbols: ReadonlyArray<{ readonly id: string; readonly weight: number }>;
}

export type GameConfig = DiceConfig | CrashConfig | CardsConfig | SlotConfig;

export interface RoundInput {
  readonly serverSeed: ServerSeed;
  readonly clientSeed: ClientSeed;
  readonly nonce: Nonce;
  readonly gameConfig: GameConfig;
}

export interface DiceResult {
  readonly type: 'dice';
  readonly roll: number;
}

export interface CrashResult {
  readonly type: 'crash';
  readonly multiplier: number;
}

export interface Card {
  readonly suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
  readonly value: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
}

export interface CardsResult {
  readonly type: 'cards';
  readonly deck: ReadonlyArray<Card>;
}

export interface SlotResult {
  readonly type: 'slot';
  readonly grid: ReadonlyArray<ReadonlyArray<string>>;
}

export type GameResult = DiceResult | CrashResult | CardsResult | SlotResult;

export interface RoundOutput {
  readonly hashes: ReadonlyArray<{ readonly cursor: Cursor; readonly hex: string }>;
  readonly rejections: ReadonlyArray<RejectionRecord>;
  readonly cursorUsed: Cursor;
  readonly result: GameResult;
}
