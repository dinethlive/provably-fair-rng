import { Badge, Card, CardBody, CardHeader, KeyValue } from '../components/ui.tsx';

export function Compliance() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-(--color-text-primary)">Compliance posture</h1>
        <p className="mt-1 max-w-3xl text-sm text-(--color-text-secondary)">
          What this engine is built to satisfy, and where each requirement is implemented in the
          codebase. This page is intended for regulators, licensing officers, and independent test
          laboratories evaluating the system before issuing credentials.
        </p>
      </header>

      <Card>
        <CardHeader
          title="Sri Lanka, Gambling Regulatory Authority Act No. 17 of 2025"
          subtitle="Operational from 1 December 2025. The most relevant local frame for any operator targeting Sri Lankan players."
          right={<Badge tone="success">primary jurisdiction</Badge>}
        />
        <CardBody className="space-y-4">
          <ReqRow
            requirement="Transparent algorithms"
            implementation="HMAC-SHA256 with published commitment / revelation protocol. Every round is fully reproducible from inputs."
            location="packages/rng-core/src/hmac.ts, packages/rng-core/src/commitment.ts"
          />
          <ReqRow
            requirement="Audited and certified"
            implementation="Codebase is open source under MIT license; verification is client-side and independent of the operator."
            location="apps/verifier (this site)"
          />
          <ReqRow
            requirement="Auditable output histories"
            implementation="Append-only round log with SHA-256 hash chain; each entry's `prevHash` references its predecessor's `entryHash`. Tamper-evident by design."
            location="packages/seed-lifecycle/src/hash-chain.ts, packages/seed-lifecycle/src/manager.ts"
          />
          <ReqRow
            requirement="Authority access for verification"
            implementation="Read-only regulator role on /v1/regulator/* endpoints with cross-tenant access to round logs and seed-pair summaries."
            location="apps/api/src/auth.ts, apps/api/src/routes.ts"
          />
          <p className="rounded-md border border-(--color-info)/30 bg-(--color-info)/8 px-4 py-3 text-xs text-(--color-info)">
            <strong>Note:</strong> GRA technical sub-regulations (specific hash algorithms,
            retention schedules, reporting cadence, certified testing labs) had not been published
            as of May 2026. The implementation tracks GLI-19 v3.0 as the closest published proxy
            and will be retrofitted when sub-regulations are issued.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="UK Gambling Commission, Remote Gambling and Software Technical Standards (RTS)"
          subtitle="The de facto international floor. Updates effective 17 Jan 2025 and 31 Oct 2025."
        />
        <CardBody className="space-y-4">
          <ReqRow
            requirement="RTS 7, RNG randomness"
            implementation='"Acceptably random" demonstrated by chi-square goodness-of-fit (p &gt; 0.01) over 1M rounds; HMAC-SHA256 passes BigCrush by construction.'
            location="packages/rng-core/test/distribution.test.ts"
          />
          <ReqRow
            requirement="ISO 27001:2022 alignment"
            implementation="Architecture supports it (TLS 1.3 mandatory, KMS-encrypted seeds at rest, RBAC, audit log immutability). Operator certification is per-deployment."
            location="GAPS.md §B7 (security architecture)"
          />
          <ReqRow
            requirement="RTP transparency"
            implementation="Per-seed-pair outcome distribution computed at rotation; available via /v1/regulator/seed-pairs/{id}/summary."
            location="packages/seed-lifecycle/src/manager.ts (computeSummary)"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Malta Gaming Authority (MGA)"
          subtitle="Compliance Audit Manual + SL 583.12 retention obligations."
        />
        <CardBody className="space-y-4">
          <ReqRow
            requirement="Tamper-proof retention, 5+ years"
            implementation="Append-only round log enforced at storage layer; immutable by construction. Retention is configured per deployment; default 12 months can be extended."
            location="packages/seed-lifecycle/src/store/types.ts (SeedPairStore), GAPS.md §B3"
          />
          <ReqRow
            requirement="On-demand history access"
            implementation="Regulator API queries by tenant + time range, paginated up to 10,000 records per call."
            location="apps/api/src/routes.ts (queryRoundsRoute)"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="GLI-19 v3.0, Gaming Laboratories International"
          subtitle="The technical certification reference for interactive gaming systems."
        />
        <CardBody className="space-y-4">
          <ReqRow
            requirement="Cryptographically secure RNG"
            implementation="OS-level CSPRNG (crypto.randomBytes) for Server Seed generation; 256-bit entropy floor."
            location="packages/seed-lifecycle/src/csprng.ts"
          />
          <ReqRow
            requirement="Bias prevention"
            implementation="Rejection sampling on uint32 segments; max valid = floor(2^32 / range) * range."
            location="packages/rng-core/src/rejection.ts"
          />
          <ReqRow
            requirement="Statistical validation"
            implementation="Chi-square goodness-of-fit, dice mean/std, slot weighted-symbol distribution, all over 1M+ rounds."
            location="packages/rng-core/test/distribution.test.ts"
          />
          <ReqRow
            requirement="Pre-commitment to outcomes"
            implementation="SHA-256 commitment delivered before any round. Cryptographically prevents post-hoc seed selection."
            location="packages/rng-core/src/commitment.ts, packages/seed-lifecycle/src/manager.ts (createSession)"
          />
          <ReqRow
            requirement="Determinism, reproducibility"
            implementation="Same inputs always produce same output. Verifiable in-browser via this UI."
            location="apps/verifier/src/lib/verifier.ts"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Gibraltar RTOS v1.1"
          subtitle="Remote Technical and Operating Standards."
        />
        <CardBody className="space-y-4">
          <ReqRow
            requirement="Separable RNG core and mapping module"
            implementation="Cleanly split: rng-core/hmac.ts produces raw bytes; rng-core/mappers/* convert to game values."
            location="packages/rng-core/src/mappers/"
          />
          <ReqRow
            requirement="Mapping must not introduce bias"
            implementation="Rejection sampling for non-power-of-2 ranges; verified by statistical tests."
            location="packages/rng-core/src/rejection.ts"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="GDPR / data protection" />
        <CardBody className="space-y-4">
          <ReqRow
            requirement="Pseudonymization"
            implementation="Engine stores opaque player IDs only. PII is the upstream auth service's concern."
            location="packages/seed-lifecycle/src/types.ts (PlayerId is opaque)"
          />
          <ReqRow
            requirement="Right to deletion"
            implementation="Upstream PII can be deleted independently while retaining pseudonymous round records for the regulatory window."
            location="GAPS.md §B21"
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Accessibility, WCAG 2.2 AA" />
        <CardBody className="space-y-4">
          <ReqRow
            requirement="Keyboard navigability"
            implementation="All interactive elements reachable via Tab; visible focus rings."
            location="apps/verifier/src/styles.css (:focus-visible rules)"
          />
          <ReqRow
            requirement="Color contrast ≥ 4.5:1"
            implementation="Theme palette designed against the AA threshold; verified in dev tools contrast checker."
            location="apps/verifier/src/styles.css (@theme block)"
          />
          <ReqRow
            requirement="Reduced motion"
            implementation="prefers-reduced-motion media query disables animations and transitions."
            location="apps/verifier/src/styles.css"
          />
        </CardBody>
      </Card>
    </div>
  );
}

function ReqRow(props: { requirement: string; implementation: string; location: string }) {
  return (
    <div className="grid gap-2 border-l-2 border-(--color-accent)/40 pl-4 lg:grid-cols-[1fr_2fr]">
      <KeyValue k="Requirement" v={<span className="font-medium">{props.requirement}</span>} />
      <div className="space-y-1.5">
        <p className="text-sm text-(--color-text-secondary)">{props.implementation}</p>
        <code className="block break-all rounded-md bg-(--color-bg-base)/80 px-2.5 py-1 font-mono text-[11px] text-(--color-text-tertiary)">
          {props.location}
        </code>
      </div>
    </div>
  );
}
