import { Badge, Card, CardBody, CardHeader, Hash } from '../components/ui.tsx';

export function Architecture() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-(--color-text-primary)">How it works</h1>
        <p className="mt-1 max-w-3xl text-sm text-(--color-text-secondary)">
          The cryptographic and operational machinery underneath the verifier. Written for
          engineers, auditors, and anyone deciding whether to trust the engine before they trust
          the operator.
        </p>
      </header>

      <Card>
        <CardHeader title="The handshake, in one diagram" />
        <CardBody>
          <pre className="overflow-x-auto rounded-md border border-(--color-border-subtle) bg-(--color-bg-base)/80 p-5 font-mono text-[11px] leading-relaxed text-(--color-text-secondary)">
{`  ┌──────────────────────────┐                       ┌──────────────────────┐
  │   OPERATOR (server)      │                       │   PLAYER (browser)   │
  └──────────────┬───────────┘                       └──────────┬───────────┘
                 │                                              │
                 │  1. CSPRNG → serverSeed (256 bits)           │
                 │  2. SHA-256(serverSeed) → commitment         │
                 │                                              │
                 │ ───── publish commitment ─────►              │
                 │                                              │
                 │             3. player picks clientSeed       │
                 │ ◄──── clientSeed (any string) ─────          │
                 │                                              │
                 │  4. for each round n = 0,1,2,…               │
                 │                                              │
                 │     hmac = HMAC-SHA256(serverSeed,           │
                 │              "{clientSeed}:{n}:{cursor}")    │
                 │     outcome = mapper(hmac, gameConfig)       │
                 │                                              │
                 │ ───── outcome (no seed) ─────►               │
                 │                                              │
                 │  5. on rotation: reveal serverSeed           │
                 │ ───── revealed serverSeed ─────►             │
                 │                                              │
                 │             6. verify in-browser:            │
                 │             SHA-256(seed) == commitment?     │
                 │             rerun mapper, match outcome?     │
                 │                                              │
  ┌──────────────┴───────────┐                       ┌──────────┴───────────┐
  │   "I cannot rig the      │                       │   "I have proof,     │
  │    outcome after the     │                       │    not just trust."  │
  │    bet was placed."      │                       │                      │
  └──────────────────────────┘                       └──────────────────────┘`}
          </pre>
          <p className="mt-3 text-xs text-(--color-text-tertiary)">
            The commitment publishes the SHA-256 of the seed before any round runs. After
            revelation, anyone can re-compute every outcome from the recorded inputs. Because the
            seed was hashed and published first, the operator cannot change it later without
            breaking the commitment.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="The four cryptographic primitives" />
        <CardBody className="space-y-6">
          <Primitive
            name="HMAC-SHA256"
            tone="success"
            spec="NIST FIPS 198-1 / RFC 4868"
            why="Keyed hash, the standard message-authentication code. Output cannot be reproduced without the key (the server seed)."
            code={`hmac = HMAC-SHA256(
  key     = serverSeed,
  message = clientSeed + ":" + nonce + ":" + cursor
)`}
          />
          <Primitive
            name="Rejection sampling"
            tone="info"
            spec="for bias-free uniform integers"
            why="Naive `value % range` over a uint32 produces slightly more low values than high ones. Rejection sampling makes the distribution exactly uniform."
            code={`MAX_VALID = floor(2^32 / range) * range
draw uint32 from byte stream
if draw >= MAX_VALID: discard, draw again
return draw mod range`}
          />
          <Primitive
            name="SHA-256 commitment"
            tone="info"
            spec="for the pre-game binding"
            why="The hash is published before play. After the seed is revealed, anyone can verify SHA-256(seed) equals the original hash, proving the seed was fixed in advance."
            code={`commitment = SHA-256(serverSeed)
// publish commitment before round 0
// reveal serverSeed at rotation
// verify: SHA-256(revealedServerSeed) == commitment`}
          />
          <Primitive
            name="Hash chain"
            tone="warning"
            spec="for tamper-evident audit logging"
            why="Each round-log entry includes prevHash = previous entry's entryHash. Modifying any historical entry invalidates the chain from that point forward, detectable in O(1) per entry."
            code={`entry_n.prevHash  = entry_{n-1}.entryHash
entry_n.entryHash = SHA-256(canonicalJSON(entry_n - entryHash))
// genesis: prevHash = 0x00...00
// verify: walk forward, recompute each entryHash`}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Data flow, per round" />
        <CardBody>
          <ol className="space-y-3 text-sm leading-relaxed text-(--color-text-secondary)">
            <li className="flex gap-3">
              <Step n={1} />
              <div>
                Service-layer reserves the next nonce atomically (per-seed-pair lock so concurrent
                rounds never collide).
              </div>
            </li>
            <li className="flex gap-3">
              <Step n={2} />
              <div>
                <code className="font-mono text-xs">HmacByteStream</code> computes the first hash
                with cursor=0; the 32-byte digest is consumed in 8 segments of 4 bytes each.
              </div>
            </li>
            <li className="flex gap-3">
              <Step n={3} />
              <div>
                The mapper for the requested game type pulls bytes (uint32 or float [0,1)) from the
                stream, applies rejection sampling where needed, returns the game value.
              </div>
            </li>
            <li className="flex gap-3">
              <Step n={4} />
              <div>
                A round-log entry is built: nonce, commitment, clientSeed, hmacOutput, cursor,
                gameConfig, result, prevHash. <code className="font-mono text-xs">entryHash</code>{' '}
                is computed and the entry appended.
              </div>
            </li>
            <li className="flex gap-3">
              <Step n={5} />
              <div>
                Outcome returned to the operator's game backend. The active server seed never
                leaves the service; only the commitment is shared.
              </div>
            </li>
          </ol>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="What gets logged" subtitle="Round-level audit record (every round, immutable)." />
        <CardBody>
          <pre className="overflow-x-auto rounded-md border border-(--color-border-subtle) bg-(--color-bg-base)/80 p-4 font-mono text-xs text-(--color-text-secondary)">
{`{
  "id":                    "round-uuid-v7",
  "tenantId":              "casino-id",
  "sessionId":             "session-uuid",
  "seedPairId":            "seed-pair-uuid",
  "nonce":                 0,
  "serverSeedCommitment":  "<sha256 hex, 64 chars>",   // public from start
  "clientSeed":            "player-supplied-string",
  "clientSeedSource":      "player" | "system-default",
  "hmacOutput":            "<hex, 64 chars>",          // recomputable
  "cursorUsed":            0,
  "gameConfig":            { "type": "dice", ... },
  "result":                { "type": "dice", "roll": 64.71 },
  "determinedAt":          "2026-05-09T20:13:40.123Z",
  "prevHash":              "<entryHash of previous round>",
  "entryHash":             "<sha256 of this entry>"     // hash chain link
}`}
          </pre>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Why this is provably fair, in plain words" />
        <CardBody>
          <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-(--color-text-secondary)">
            <li>
              The operator publishes the <em>hash</em> of the server seed before any round. They
              are now committed: any later change to the seed would change the hash.
            </li>
            <li>
              The player contributes a client seed. The operator does not control it.
            </li>
            <li>
              Each round combines server seed (committed), client seed (player&apos;s), and a
              sequential nonce. The output is determined by all three and reproducible from all
              three.
            </li>
            <li>
              At rotation, the operator reveals the server seed. The player verifies
              SHA-256(revealed) equals the original commitment, then re-runs every round&apos;s
              math in their browser, and confirms each recorded outcome.
            </li>
            <li>
              If even one outcome was tampered with, the recomputation would diverge.
              Cryptographically, the operator cannot cheat without breaking SHA-256, which is
              computationally infeasible.
            </li>
          </ol>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Example, real numbers from the engine" />
        <CardBody className="space-y-3">
          <p className="text-sm text-(--color-text-secondary)">
            For inputs <code className="font-mono">serverSeed=&quot;a&quot;.repeat(64)</code>,{' '}
            <code className="font-mono">clientSeed=&quot;cli&quot;</code>, <code className="font-mono">nonce=7</code>,
            cursor 0:
          </p>
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-wider text-(--color-text-tertiary)">
              HMAC-SHA256 digest
            </span>
            <Hash value="6c84f7b68a93b6cdaa97c6e9be32fda64eb4f8c0d12c9e3aa6c6ee6e4c63f2c4" />
            <p className="text-xs text-(--color-text-tertiary)">
              (Illustrative. The actual hex you get in the verifier with these inputs is
              deterministic, paste them into the Verify page to see for yourself.)
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-md border border-(--color-border-strong) bg-(--color-bg-elevated) font-mono text-xs text-(--color-text-secondary)">
      {n}
    </span>
  );
}

function Primitive(props: {
  name: string;
  tone: 'success' | 'info' | 'warning';
  spec: string;
  why: string;
  code: string;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr]">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-(--color-text-primary)">{props.name}</h3>
          <Badge tone={props.tone}>{props.spec}</Badge>
        </div>
        <p className="text-sm text-(--color-text-secondary)">{props.why}</p>
      </div>
      <pre className="overflow-x-auto rounded-md border border-(--color-border-subtle) bg-(--color-bg-base)/80 p-4 font-mono text-xs leading-relaxed text-(--color-text-secondary)">
        {props.code}
      </pre>
    </div>
  );
}
