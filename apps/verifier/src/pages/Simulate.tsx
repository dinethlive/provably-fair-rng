import { useState } from 'react';
import type { GameConfig } from '@pf/rng-core';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Label,
  TextInput,
} from '../components/ui.tsx';
import { defaultsFor, GameConfigForm } from '../components/GameConfigForm.tsx';
import { verify } from '../lib/verifier.ts';

interface SimRow {
  readonly nonce: number;
  readonly summary: string;
}

export function Simulate() {
  const [serverSeed, setServerSeed] = useState('demo-server-seed-32-bytes-hex-or-any-string');
  const [clientSeed, setClientSeed] = useState('demo-client');
  const [startNonce, setStartNonce] = useState(0);
  const [count, setCount] = useState(50);
  const [gameConfig, setGameConfig] = useState<GameConfig>(defaultsFor('dice'));
  const [rows, setRows] = useState<ReadonlyArray<SimRow>>([]);

  const onRun = () => {
    const out: SimRow[] = [];
    for (let i = 0; i < count; i++) {
      const r = verify({ serverSeed, clientSeed, nonce: startNonce + i, gameConfig });
      out.push({ nonce: startNonce + i, summary: summarize(r.trace.result) });
    }
    setRows(out);
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-(--color-text-primary)">Simulate</h1>
        <p className="mt-1 text-sm text-(--color-text-secondary)">
          Generate a deterministic sequence from custom inputs. Useful for B2B buyers and regulators
          checking the mapping layer against expected distributions.
        </p>
      </header>

      <Card>
        <CardHeader title="Inputs" />
        <CardBody className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Label>
              Server seed
              <TextInput mono value={serverSeed} onChange={(e) => setServerSeed(e.target.value)} />
            </Label>
            <Label>
              Client seed
              <TextInput mono value={clientSeed} onChange={(e) => setClientSeed(e.target.value)} />
            </Label>
            <Label>
              Starting nonce
              <TextInput
                type="number"
                min={0}
                value={startNonce}
                onChange={(e) => setStartNonce(Math.max(0, Number(e.target.value)))}
              />
            </Label>
            <Label hint="Number of consecutive nonces to compute.">
              Round count
              <TextInput
                type="number"
                min={1}
                max={5000}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(5000, Number(e.target.value))))}
              />
            </Label>
          </div>
          <hr className="border-(--color-border-subtle)" />
          <GameConfigForm value={gameConfig} onChange={setGameConfig} />
          <div className="pt-2">
            <Button onClick={onRun}>Run simulation</Button>
          </div>
        </CardBody>
      </Card>

      {rows.length > 0 ? (
        <Card>
          <CardHeader
            title="Sequence"
            subtitle="Each row is a deterministic outcome, same inputs always produce the same output."
            right={<Badge tone="info">{rows.length} rounds</Badge>}
          />
          <CardBody>
            <div className="max-h-[28rem] overflow-auto rounded-md border border-(--color-border-subtle)">
              <table className="w-full min-w-[24rem] text-sm">
                <thead className="sticky top-0 bg-(--color-bg-elevated) text-left text-xs uppercase tracking-wider text-(--color-text-tertiary)">
                  <tr>
                    <th className="px-4 py-2">Nonce</th>
                    <th className="px-4 py-2">Outcome</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {rows.map((r) => (
                    <tr key={r.nonce} className="border-t border-(--color-border-subtle)">
                      <td className="px-4 py-2 text-(--color-text-secondary)">{r.nonce}</td>
                      <td className="px-4 py-2 text-(--color-text-primary)">{r.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function summarize(r: ReturnType<typeof verify>['trace']['result']): string {
  if (r.type === 'dice') return `dice ${r.roll}`;
  if (r.type === 'crash') return `crash ×${r.multiplier.toFixed(2)}`;
  if (r.type === 'cards') {
    const top3 = r.deck.slice(0, 3).map((c) => `${c.value}${suitGlyph(c.suit)}`);
    return `top: ${top3.join(' ')}…`;
  }
  if (r.type === 'slot') {
    return `[${r.grid.map((col) => col[0]).join(' | ')}]`;
  }
  return '';
}
function suitGlyph(s: string): string {
  return s === 'hearts' ? '♥' : s === 'diamonds' ? '♦' : s === 'clubs' ? '♣' : '♠';
}
