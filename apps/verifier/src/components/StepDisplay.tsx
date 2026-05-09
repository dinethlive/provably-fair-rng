/**
 * Step-by-step trace of how the inputs become the recorded outcome.
 * Required by PRD Ch.5: every intermediate value must be visible to the auditor.
 */

import type { VerifyOutput } from '../lib/verifier.ts';
import { Badge, Card, CardBody, CardHeader, Hash, KeyValue } from './ui.tsx';

export function StepDisplay({ result }: { result: VerifyOutput }) {
  const r = result.trace.result;
  return (
    <Card>
      <CardHeader
        title="Verification trace"
        subtitle="Each step the engine performed to map your inputs into the recorded game outcome."
        right={<TraceStatus result={result} />}
      />
      <CardBody className="space-y-8">
        <Step n={1} title="Compute commitment">
          <p className="text-sm text-(--color-text-secondary)">
            <code className="font-mono">SHA-256(serverSeed)</code> binds the server's randomness
            before play. This must equal the commitment you saw before the round.
          </p>
          <div className="mt-3">
            <Hash value={result.commitment} />
            {result.commitmentMatches === false ? (
              <p className="mt-2 text-sm text-(--color-danger)">
                ⚠ Commitment mismatch, the seed you provided does not produce the expected commitment.
              </p>
            ) : null}
          </div>
        </Step>

        <Step n={2} title="HMAC-SHA256 byte stream">
          <p className="text-sm text-(--color-text-secondary)">
            Key = <code className="font-mono">serverSeed</code>. Message ={' '}
            <code className="font-mono">{`${result.trace.hmacInputs.clientSeed}:${result.trace.hmacInputs.nonce}:${result.trace.hmacInputs.cursor}`}</code>
            . Cursor advances when the 32 bytes of one digest are exhausted.
          </p>
          <div className="mt-3 space-y-2">
            {result.trace.hashes.map((h) => (
              <div key={h.cursor} className="flex items-start gap-3">
                <span className="mt-2 inline-flex shrink-0 rounded-md bg-(--color-bg-elevated) px-2 py-0.5 font-mono text-[11px] text-(--color-text-tertiary)">
                  cursor {h.cursor}
                </span>
                <div className="flex-1">
                  <Hash value={h.hex} />
                </div>
              </div>
            ))}
          </div>
        </Step>

        <Step n={3} title="Mapping">
          <p className="text-sm text-(--color-text-secondary)">
            Bytes are consumed in 4-byte segments and converted to game values via the mapper.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <KeyValue k="Game type" v={<span className="capitalize">{r.type}</span>} />
            <KeyValue k="Cursor used" v={result.trace.cursorUsed} />
            <KeyValue
              k="Hashes consumed"
              v={`${result.trace.hashes.length} (${result.trace.hashes.length * 8} segments)`}
            />
            <KeyValue
              k="Result match"
              v={
                result.resultMatches === null ? (
                  <Badge tone="neutral">no expected result</Badge>
                ) : result.resultMatches ? (
                  <Badge tone="success">matches</Badge>
                ) : (
                  <Badge tone="danger">mismatch</Badge>
                )
              }
            />
          </div>
        </Step>

        <Step n={4} title="Recorded outcome">
          <ResultDisplay result={result} />
        </Step>
      </CardBody>
    </Card>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-[3rem_1fr]">
      <div className="hidden md:block">
        <div className="grid size-9 place-items-center rounded-lg border border-(--color-border-strong) bg-(--color-bg-elevated) font-mono text-sm text-(--color-text-secondary)">
          {n}
        </div>
      </div>
      <div>
        <h3 className="text-base font-semibold text-(--color-text-primary)">{title}</h3>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

function ResultDisplay({ result }: { result: VerifyOutput }) {
  const r = result.trace.result;
  if (r.type === 'dice') {
    return (
      <div className="rounded-md border border-(--color-border-subtle) bg-(--color-bg-base)/60 px-4 py-4">
        <div className="text-xs uppercase tracking-wider text-(--color-text-tertiary)">Roll</div>
        <div className="mt-1 font-mono text-3xl text-(--color-accent)">{r.roll}</div>
      </div>
    );
  }
  if (r.type === 'crash') {
    return (
      <div className="rounded-md border border-(--color-border-subtle) bg-(--color-bg-base)/60 px-4 py-4">
        <div className="text-xs uppercase tracking-wider text-(--color-text-tertiary)">Multiplier</div>
        <div className="mt-1 font-mono text-3xl text-(--color-accent)">×{r.multiplier.toFixed(2)}</div>
      </div>
    );
  }
  if (r.type === 'cards') {
    return (
      <div className="grid grid-cols-13 gap-1.5 sm:grid-cols-13">
        {r.deck.slice(0, 26).map((c, i) => (
          <div
            key={i}
            className="grid h-14 place-items-center rounded-md border border-(--color-border-subtle) bg-(--color-bg-base)/80 font-mono text-sm text-(--color-text-primary)"
            title={`${c.value} of ${c.suit}`}
          >
            <span className={c.suit === 'hearts' || c.suit === 'diamonds' ? 'text-(--color-danger)' : ''}>
              {c.value}
              <span className="ml-0.5 text-xs">{suitGlyph(c.suit)}</span>
            </span>
          </div>
        ))}
        {r.deck.length > 26 ? (
          <div className="col-span-13 text-xs text-(--color-text-tertiary)">
            …and {r.deck.length - 26} more
          </div>
        ) : null}
      </div>
    );
  }
  if (r.type === 'slot') {
    return (
      <div className="inline-grid gap-2" style={{ gridTemplateColumns: `repeat(${r.grid.length}, minmax(0, 1fr))` }}>
        {r.grid.map((col, i) => (
          <div key={i} className="space-y-2">
            {col.map((sym, j) => (
              <div
                key={j}
                className="grid h-14 w-14 place-items-center rounded-md border border-(--color-border-subtle) bg-(--color-bg-elevated) font-mono text-xs uppercase text-(--color-text-secondary)"
              >
                {sym}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function suitGlyph(suit: 'hearts' | 'diamonds' | 'clubs' | 'spades'): string {
  return suit === 'hearts' ? '♥' : suit === 'diamonds' ? '♦' : suit === 'clubs' ? '♣' : '♠';
}

function TraceStatus({ result }: { result: VerifyOutput }) {
  if (result.commitmentMatches === false || result.resultMatches === false) {
    return <Badge tone="danger">verification failed</Badge>;
  }
  if (result.commitmentMatches === true && result.resultMatches === true) {
    return <Badge tone="success">fully verified</Badge>;
  }
  if (result.commitmentMatches === true || result.resultMatches === true) {
    return <Badge tone="success">verified (partial inputs)</Badge>;
  }
  return <Badge tone="info">simulation</Badge>;
}
