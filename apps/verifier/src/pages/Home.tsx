import { Link } from 'react-router-dom';

import { Badge, Card, CardBody, CardHeader } from '../components/ui.tsx';

export function Home() {
  return (
    <div className="space-y-10 sm:space-y-12">
      <section className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div>
          <Badge tone="success">HMAC-SHA256 · Client-side</Badge>
          <h1 className="mt-5 text-3xl font-semibold leading-[1.05] tracking-tight text-(--color-text-primary) sm:text-4xl lg:text-5xl">
            Verify any game outcome
            <br />
            <span className="text-(--color-accent)">from first principles.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-(--color-text-secondary) sm:text-base">
            This tool reproduces the engine's computation on your device. No login, no API call,
            no trust in the operator. The same library the operator runs on the server runs here
            in your browser, paste in the seeds and nonce, see the result.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              to="/verify"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-(--color-accent) px-5 py-2.5 text-sm font-medium text-(--color-bg-base) transition active:scale-[0.98] hover:bg-(--color-accent-strong)"
            >
              Verify a round →
            </Link>
            <Link
              to="/simulate"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-(--color-border-strong) bg-(--color-bg-elevated) px-5 py-2.5 text-sm font-medium text-(--color-text-primary) transition active:scale-[0.98] hover:bg-(--color-bg-elevated)/80"
            >
              Run a simulation
            </Link>
          </div>
        </div>
        <Card className="self-start">
          <CardHeader title="The handshake" subtitle="Three values, one verifiable output." />
          <CardBody>
            <ol className="space-y-5">
              <PrincipleItem
                step="01"
                title="Commit"
                body={
                  <>
                    Server publishes <code className="font-mono">SHA-256(serverSeed)</code> before play.
                    The seed itself stays sealed.
                  </>
                }
              />
              <PrincipleItem
                step="02"
                title="Play"
                body={
                  <>
                    Each round combines server seed, your client seed, and a sequential nonce in HMAC-SHA256
                    to produce a deterministic outcome.
                  </>
                }
              />
              <PrincipleItem
                step="03"
                title="Reveal"
                body={
                  <>
                    On rotation, the server seed is unsealed. <code className="font-mono">SHA-256</code> of
                    the revealed seed must equal the original commitment, and you can re-derive every
                    round here.
                  </>
                }
              />
            </ol>
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Seed entropy" value="256 bits" hint="CSPRNG-generated server seeds, RFC 4868 / NIST FIPS 198-1." />
        <Stat label="Hash" value="HMAC-SHA256" hint="Same construction as Stake, BC.Game, Roobet, GLI-19 audits." />
        <Stat label="Bias" value="0.000%" hint="Rejection sampling eliminates modulo bias on every range." />
        <Stat label="Audit log" value="Hash chain" hint="Every round links to the previous via SHA-256, tamper-evident by design." />
      </section>

      <section>
        <Card>
          <CardHeader title="Compliance posture" subtitle="What this engine is built to satisfy." />
          <CardBody>
            <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Compliance regulator="UKGC" detail="RTS 7 (RNG), ISO 27001:2022 alignment, RTP transparency." />
              <Compliance regulator="MGA" detail="Audit log retention; on-demand history. SL 583.12 retention requirements." />
              <Compliance regulator="Gibraltar RTOS" detail="Separable RNG core + mapping module; certifiable per RTOS v1.1." />
              <Compliance regulator="GLI-19 v3.0" detail="Statistical validation, traceable inputs, rejection sampling for bias." />
              <Compliance regulator="Sri Lanka GRA" detail="Algorithm-certifiable architecture per Act No. 17 of 2025." />
              <Compliance regulator="GDPR" detail="Pseudonymous round records; PII isolated upstream." />
              <Compliance regulator="WCAG 2.2 AA" detail="Verifier UI: keyboard-navigable, screen-reader-friendly, ≥ 4.5:1 contrast." />
              <Compliance regulator="Open source" detail="RNG core MIT-licensed. The engine is verifiable, not just the outcomes." />
            </dl>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}

function PrincipleItem({
  step,
  title,
  body,
}: {
  step: string;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span className="font-mono text-xs text-(--color-text-tertiary)">{step}</span>
      <div>
        <div className="text-sm font-semibold text-(--color-text-primary)">{title}</div>
        <div className="mt-1 text-sm text-(--color-text-secondary)">{body}</div>
      </div>
    </li>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="px-5 py-5">
      <div className="text-xs uppercase tracking-wider text-(--color-text-tertiary)">{label}</div>
      <div className="mt-2 font-mono text-2xl text-(--color-accent)">{value}</div>
      <div className="mt-2 text-xs leading-snug text-(--color-text-secondary)">{hint}</div>
    </Card>
  );
}

function Compliance({ regulator, detail }: { regulator: string; detail: string }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-(--color-text-primary)">{regulator}</dt>
      <dd className="mt-1 text-xs leading-snug text-(--color-text-secondary)">{detail}</dd>
    </div>
  );
}
