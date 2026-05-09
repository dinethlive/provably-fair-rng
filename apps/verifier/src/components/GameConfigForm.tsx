import type { GameConfig } from '@pf/rng-core';

import { Label, Select, TextInput } from './ui.tsx';

export interface GameConfigFormProps {
  readonly value: GameConfig;
  readonly onChange: (next: GameConfig) => void;
}

export function GameConfigForm({ value, onChange }: GameConfigFormProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Label htmlFor="game-type" hint="Pick the game whose outcome is being verified.">
        Game type
        <Select
          id="game-type"
          value={value.type}
          onChange={(e) => onChange(defaultsFor(e.target.value as GameConfig['type']))}
        >
          <option value="dice">Dice</option>
          <option value="crash">Crash</option>
          <option value="cards">Cards (52-card)</option>
          <option value="slot">Slot</option>
        </Select>
      </Label>
      {value.type === 'dice' ? <DiceFields value={value} onChange={onChange} /> : null}
      {value.type === 'crash' ? <CrashFields value={value} onChange={onChange} /> : null}
      {value.type === 'cards' ? <CardsFields value={value} onChange={onChange} /> : null}
      {value.type === 'slot' ? <SlotFields value={value} onChange={onChange} /> : null}
    </div>
  );
}

function DiceFields({
  value,
  onChange,
}: {
  value: Extract<GameConfig, { type: 'dice' }>;
  onChange: (g: GameConfig) => void;
}) {
  return (
    <>
      <Label hint="Inclusive lower bound of the roll.">
        Min
        <TextInput
          type="number"
          step="any"
          value={value.minRoll}
          onChange={(e) => onChange({ ...value, minRoll: Number(e.target.value) })}
        />
      </Label>
      <Label hint="Exclusive upper bound of the roll.">
        Max
        <TextInput
          type="number"
          step="any"
          value={value.maxRoll}
          onChange={(e) => onChange({ ...value, maxRoll: Number(e.target.value) })}
        />
      </Label>
      <Label hint="Decimal places retained after truncation.">
        Decimals
        <TextInput
          type="number"
          min={0}
          max={8}
          value={value.decimals}
          onChange={(e) =>
            onChange({ ...value, decimals: Math.max(0, Math.min(8, Number(e.target.value))) })
          }
        />
      </Label>
    </>
  );
}

function CrashFields({
  value,
  onChange,
}: {
  value: Extract<GameConfig, { type: 'crash' }>;
  onChange: (g: GameConfig) => void;
}) {
  return (
    <Label hint="Optional: explicit instabust rate is 1 / divisor. Leave empty for the formula's natural 1% floor.">
      Instant-bust divisor (optional)
      <TextInput
        type="number"
        min={2}
        value={value.instantBustDivisor ?? ''}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (e.target.value === '' || Number.isNaN(n)) {
            const { instantBustDivisor: _drop, ...rest } = value;
            void _drop;
            onChange(rest);
          } else {
            onChange({ ...value, instantBustDivisor: n });
          }
        }}
      />
    </Label>
  );
}

function CardsFields({
  value,
  onChange,
}: {
  value: Extract<GameConfig, { type: 'cards' }>;
  onChange: (g: GameConfig) => void;
}) {
  return (
    <Label hint="1 = single 52-card deck. Up to 8 decks for blackjack shoes.">
      Deck count
      <TextInput
        type="number"
        min={1}
        max={8}
        value={value.deckCount}
        onChange={(e) => onChange({ ...value, deckCount: Math.max(1, Math.min(8, Number(e.target.value))) })}
      />
    </Label>
  );
}

function SlotFields({
  value,
  onChange,
}: {
  value: Extract<GameConfig, { type: 'slot' }>;
  onChange: (g: GameConfig) => void;
}) {
  return (
    <>
      <Label>
        Reels
        <TextInput
          type="number"
          min={1}
          max={10}
          value={value.reels}
          onChange={(e) => onChange({ ...value, reels: Math.max(1, Math.min(10, Number(e.target.value))) })}
        />
      </Label>
      <Label>
        Rows
        <TextInput
          type="number"
          min={1}
          max={10}
          value={value.rows}
          onChange={(e) => onChange({ ...value, rows: Math.max(1, Math.min(10, Number(e.target.value))) })}
        />
      </Label>
      <Label
        hint="Comma-separated 'id:weight' pairs. Higher weight = higher probability."
      >
        Symbols
        <TextInput
          mono
          value={value.symbols.map((s) => `${s.id}:${s.weight}`).join(', ')}
          onChange={(e) => {
            const symbols = e.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
              .map((pair) => {
                const [id, weight] = pair.split(':').map((p) => p.trim());
                return { id: id ?? 'sym', weight: Number(weight) || 1 };
              });
            onChange({ ...value, symbols: symbols.length ? symbols : value.symbols });
          }}
        />
      </Label>
    </>
  );
}

export function defaultsFor(type: GameConfig['type']): GameConfig {
  switch (type) {
    case 'dice':
      return { type: 'dice', minRoll: 0, maxRoll: 100, decimals: 2 };
    case 'crash':
      return { type: 'crash' };
    case 'cards':
      return { type: 'cards', deckCount: 1 };
    case 'slot':
      return {
        type: 'slot',
        reels: 5,
        rows: 3,
        symbols: [
          { id: 'wild', weight: 1 },
          { id: 'scatter', weight: 2 },
          { id: 'high', weight: 5 },
          { id: 'mid', weight: 10 },
          { id: 'low', weight: 20 },
        ],
      };
  }
}
