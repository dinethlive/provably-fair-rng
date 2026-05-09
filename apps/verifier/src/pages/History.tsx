import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Badge, Button, Card, CardBody, CardHeader, Hash, KeyValue } from '../components/ui.tsx';

interface DemoRound {
  readonly id: string;
  readonly nonce: number;
  readonly clientSeed: string;
  readonly outcome: string;
  readonly commitment: string;
}

const DEMO_ROUNDS: ReadonlyArray<DemoRound> = [
  {
    id: 'round-001',
    nonce: 0,
    clientSeed: 'player-cli-1',
    outcome: 'dice 64.71',
    commitment: 'fa4f5e7e1ad7c4c0bbabc5b56fa3a9ff2c45d0a7e9d4e9d8a1cba2bb8ee1aa11',
  },
  {
    id: 'round-002',
    nonce: 1,
    clientSeed: 'player-cli-1',
    outcome: 'dice 12.04',
    commitment: 'fa4f5e7e1ad7c4c0bbabc5b56fa3a9ff2c45d0a7e9d4e9d8a1cba2bb8ee1aa11',
  },
  {
    id: 'round-003',
    nonce: 2,
    clientSeed: 'player-cli-1',
    outcome: 'crash ×3.42',
    commitment: 'fa4f5e7e1ad7c4c0bbabc5b56fa3a9ff2c45d0a7e9d4e9d8a1cba2bb8ee1aa11',
  },
  {
    id: 'round-004',
    nonce: 3,
    clientSeed: 'player-cli-1',
    outcome: 'cards top: A♠ K♥ 7♦…',
    commitment: 'fa4f5e7e1ad7c4c0bbabc5b56fa3a9ff2c45d0a7e9d4e9d8a1cba2bb8ee1aa11',
  },
];

export function History() {
  const [imported, setImported] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        const parsed = JSON.parse(text);
        setImported(parsed);
      } catch (err) {
        setError((err as Error).message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-(--color-text-primary)">Game history</h1>
          <p className="mt-1 text-sm text-(--color-text-secondary)">
            For each completed round: round number, outcome, the active commitment, and a direct link to
            verify it. Import your operator's session-history JSON or browse the demo below.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-(--color-border-strong) bg-(--color-bg-elevated) px-4 py-2 text-sm font-medium text-(--color-text-primary) transition hover:bg-(--color-bg-elevated)/80">
          Import session JSON
          <input type="file" accept="application/json" className="hidden" onChange={onFileChange} />
        </label>
      </header>

      {error ? (
        <p className="rounded-md border border-(--color-danger)/30 bg-(--color-danger)/10 px-4 py-3 text-sm text-(--color-danger)">
          Failed to parse JSON: {error}
        </p>
      ) : null}

      {imported ? (
        <Card>
          <CardHeader title="Imported session" subtitle="Raw JSON view." />
          <CardBody>
            <pre className="max-h-96 overflow-auto rounded-md border border-(--color-border-subtle) bg-(--color-bg-base)/80 p-4 font-mono text-xs text-(--color-text-secondary)">
              {JSON.stringify(imported, null, 2)}
            </pre>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Demo session"
          subtitle="Illustrative, replace with your real history via Import."
          right={<Badge tone="success">commitment locked</Badge>}
        />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <KeyValue k="Session id" v={<span className="font-mono text-xs">demo-session-001</span>} />
            <KeyValue k="Player id" v={<span className="font-mono text-xs">demo-player</span>} />
          </div>
          <div className="mt-6">
            <div className="text-xs uppercase tracking-wider text-(--color-text-tertiary)">
              Active commitment
            </div>
            <div className="mt-2">
              <Hash value={DEMO_ROUNDS[0]!.commitment} />
            </div>
          </div>

          <div className="mt-8 overflow-x-auto rounded-md border border-(--color-border-subtle)">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="bg-(--color-bg-elevated) text-left text-xs uppercase tracking-wider text-(--color-text-tertiary)">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Outcome</th>
                  <th className="px-4 py-2">Client seed</th>
                  <th className="px-4 py-2 text-right">Verify</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_ROUNDS.map((r) => (
                  <tr key={r.id} className="border-t border-(--color-border-subtle)">
                    <td className="px-4 py-2 font-mono text-(--color-text-secondary)">{r.nonce}</td>
                    <td className="px-4 py-2 font-mono text-(--color-text-primary)">{r.outcome}</td>
                    <td className="px-4 py-2 font-mono text-xs text-(--color-text-secondary)">{r.clientSeed}</td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        to={`/verify?clientSeed=${encodeURIComponent(r.clientSeed)}&nonce=${r.nonce}&commitment=${r.commitment}&gameType=${r.outcome.startsWith('dice') ? 'dice' : r.outcome.startsWith('crash') ? 'crash' : r.outcome.startsWith('cards') ? 'cards' : 'slot'}`}
                        className="text-(--color-accent) hover:underline"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-(--color-text-tertiary)">
            Note: this demo session has a placeholder commitment. Use the Verify page after rotation to check
            <code className="font-mono"> SHA-256(serverSeed) == commitment</code>.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="What to look for" />
        <CardBody>
          <ul className="space-y-3 text-sm leading-relaxed text-(--color-text-secondary)">
            <li className="flex gap-3">
              <Badge tone="success">1</Badge>
              <span>
                Every round in a session shares the same commitment until rotation, that's the binding
                contract. If commitment changes mid-session without a rotation event, the operator violated
                the protocol.
              </span>
            </li>
            <li className="flex gap-3">
              <Badge tone="success">2</Badge>
              <span>
                After rotation, the revealed Server Seed must hash (SHA-256) to the previously-shown
                commitment. If it doesn't, the operator selected the seed after the fact.
              </span>
            </li>
            <li className="flex gap-3">
              <Badge tone="success">3</Badge>
              <span>
                Re-running this verifier on any historic round should reproduce the recorded outcome. A
                discrepancy is cryptographic proof of tampering.
              </span>
            </li>
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
