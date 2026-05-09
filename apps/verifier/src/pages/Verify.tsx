import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { GameConfig } from '@pf/rng-core';

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Label,
  TextInput,
} from '../components/ui.tsx';
import { defaultsFor, GameConfigForm } from '../components/GameConfigForm.tsx';
import { StepDisplay } from '../components/StepDisplay.tsx';
import { verify, type VerifyOutput } from '../lib/verifier.ts';

export function Verify() {
  const [params, setParams] = useSearchParams();

  const [serverSeed, setServerSeed] = useState(params.get('serverSeed') ?? '');
  const [clientSeed, setClientSeed] = useState(params.get('clientSeed') ?? '');
  const [nonce, setNonce] = useState<number>(Number(params.get('nonce') ?? 0));
  const [expectedCommitment, setExpectedCommitment] = useState(params.get('commitment') ?? '');
  const [gameConfig, setGameConfig] = useState<GameConfig>(() =>
    paramToConfig(params) ?? defaultsFor('dice'),
  );

  const [output, setOutput] = useState<VerifyOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRun = serverSeed.trim().length > 0 && Number.isFinite(nonce);

  const onRun = () => {
    setError(null);
    try {
      const result = verify({
        serverSeed: serverSeed.trim(),
        clientSeed,
        nonce,
        gameConfig,
        expectedCommitment: expectedCommitment.trim() || null,
      });
      setOutput(result);
      const next = new URLSearchParams();
      next.set('serverSeed', serverSeed.trim());
      next.set('clientSeed', clientSeed);
      next.set('nonce', String(nonce));
      if (expectedCommitment.trim()) next.set('commitment', expectedCommitment.trim());
      writeConfigParams(next, gameConfig);
      setParams(next, { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setOutput(null);
    }
  };

  // Auto-run if all required fields came in via URL
  useEffect(() => {
    if (params.get('serverSeed') && params.get('nonce')) {
      onRun();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-(--color-text-primary)">Verify a round</h1>
          <p className="mt-1 text-sm text-(--color-text-secondary)">
            Paste in the inputs from your session history. The computation runs locally, nothing leaves
            your browser.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader title="Inputs" />
        <CardBody className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Label hint="Revealed after rotation. Hex or any string the operator used.">
              Server seed (revealed)
              <TextInput
                mono
                value={serverSeed}
                onChange={(e) => setServerSeed(e.target.value)}
                placeholder="abcdef…"
              />
            </Label>
            <Label hint="The seed the player supplied (or system default that was recorded).">
              Client seed
              <TextInput
                mono
                value={clientSeed}
                onChange={(e) => setClientSeed(e.target.value)}
                placeholder="player-seed"
              />
            </Label>
            <Label hint="Round number within the seed pair, starting at 0.">
              Nonce
              <TextInput
                type="number"
                min={0}
                value={Number.isFinite(nonce) ? nonce : 0}
                onChange={(e) => setNonce(Number(e.target.value))}
              />
            </Label>
            <Label hint="Optional, the SHA-256 commitment shown before play.">
              Expected commitment (optional)
              <TextInput
                mono
                value={expectedCommitment}
                onChange={(e) => setExpectedCommitment(e.target.value)}
                placeholder="64 hex chars"
              />
            </Label>
          </div>
          <hr className="border-(--color-border-subtle)" />
          <GameConfigForm value={gameConfig} onChange={setGameConfig} />
          {error ? <p className="text-sm text-(--color-danger)">{error}</p> : null}
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={onRun} disabled={!canRun}>
              Verify
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
              }}
            >
              Copy link
            </Button>
          </div>
        </CardBody>
      </Card>

      {output ? <StepDisplay result={output} /> : <Empty />}
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-xl border border-dashed border-(--color-border-subtle) px-6 py-12 text-center text-sm text-(--color-text-tertiary)">
      Enter the four inputs above and press Verify to see the trace.
    </div>
  );
}

function paramToConfig(p: URLSearchParams): GameConfig | null {
  const type = p.get('gameType') as GameConfig['type'] | null;
  if (!type) return null;
  if (type === 'dice') {
    return {
      type,
      minRoll: Number(p.get('minRoll') ?? 0),
      maxRoll: Number(p.get('maxRoll') ?? 100),
      decimals: Number(p.get('decimals') ?? 2),
    };
  }
  if (type === 'crash') {
    const ibd = p.get('instantBustDivisor');
    return ibd ? { type, instantBustDivisor: Number(ibd) } : { type };
  }
  if (type === 'cards') {
    return { type, deckCount: Number(p.get('deckCount') ?? 1) };
  }
  if (type === 'slot') {
    return defaultsFor('slot');
  }
  return null;
}

function writeConfigParams(p: URLSearchParams, c: GameConfig) {
  p.set('gameType', c.type);
  if (c.type === 'dice') {
    p.set('minRoll', String(c.minRoll));
    p.set('maxRoll', String(c.maxRoll));
    p.set('decimals', String(c.decimals));
  } else if (c.type === 'crash' && c.instantBustDivisor !== undefined) {
    p.set('instantBustDivisor', String(c.instantBustDivisor));
  } else if (c.type === 'cards') {
    p.set('deckCount', String(c.deckCount));
  }
}
