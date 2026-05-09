# Provably Fair RNG Engine

A regulator-credible, open-source random-number generator for online gambling. HMAC-SHA256 with pre-game commitment, append-only audit log, and a verification UI players can run in their own browser.

Built as a reference implementation for the **Sri Lanka Gambling Regulatory Authority Act No. 17 of 2025** (operational 1 December 2025), and aligned with **UKGC RTS, MGA SL 583.12, GLI-19 v3.0, and Gibraltar RTOS v1.1** so the same engine works for operators in any of those jurisdictions.

## Why this exists

Online casinos have a trust problem, the operator generates the random numbers, so how does the player know the outcome wasn't picked after they placed the bet?

**Provably Fair** is the cryptographic answer:

1. The operator publishes the **SHA-256 hash** of a randomly-generated server seed *before* play.
2. Every round combines that server seed, a player-supplied client seed, and a sequential nonce in HMAC-SHA256.
3. At rotation, the server seed is revealed. Anyone can verify `SHA-256(revealed) == commitment`, and re-run the math for every round.

The operator literally cannot change an outcome after the fact without breaking SHA-256.

## What's in the box

| Package | What it is |
|---|---|
| `packages/rng-core` | The cryptographic engine, HMAC-SHA256 byte stream, rejection-sampling mappers for dice / crash / cards / slots, SHA-256 commitment helpers. Pure TypeScript, isomorphic. |
| `packages/seed-lifecycle` | Service layer, CSPRNG seed generation, pre-game commitment, atomic nonce reservation, rotation, immutable round log with hash chain, seed-pair summary reports. |
| `apps/api` | REST API on Hono with OpenAPI 3.1 spec. Two roles, tenant (operator) and regulator (read-only cross-tenant). API-key authenticated. |
| `apps/verifier` | Static React UI. Verifies any round in the player's own browser. No login, no server-side computation, fully independent of the operator. |

## Live demo

- **Verifier UI**, [open the live site](#) (deploy yours via Cloudflare Pages / Vercel)
- **API**, run locally, see Quick start

## Quick start

```bash
# requires Node 22+ and pnpm 10+

pnpm install

# run both servers in parallel
pnpm dev

# or one at a time
pnpm --filter @pf/api dev         # http://localhost:3000
pnpm --filter @pf/verifier dev    # http://localhost:5173
```

The verifier opens with a Home / Verify / Simulate / History / API / Compliance / How it works nav. Try the **Verify** page, paste any server seed + client seed + nonce, watch the engine reproduce the outcome step by step.

## End-to-end example

```bash
API=http://localhost:3000
KEY="demo-tenant-key-CHANGE-ME-IN-PRODUCTION"

# 1. create a session, you get a SHA-256 commitment of the server seed
curl -X POST $API/v1/sessions \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"playerId":"p1","clientSeed":"my-lucky-seed"}'

# 2. place a round, returns a determined outcome and an immutable log entry
curl -X POST $API/v1/rounds \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"sessionId":"<id>","gameConfig":{"type":"dice","minRoll":0,"maxRoll":100,"decimals":2}}'

# 3. rotate, reveals the server seed
curl -X POST $API/v1/sessions/<id>/rotate \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" -d '{}'

# 4. verify in browser, http://localhost:5173/verify with the inputs above
```

## Tech stack

- **Cryptography**: [`@noble/hashes`](https://github.com/paulmillr/noble-hashes) v2 (audited, isomorphic)
- **Backend**: Node 22 LTS, [Hono 4](https://hono.dev/), [`@hono/zod-openapi`](https://www.npmjs.com/package/@hono/zod-openapi), Zod 4, Pino 9
- **Frontend**: React 19, Vite 6, Tailwind CSS v4, React Router 7
- **Tooling**: pnpm 10 workspace, Turborepo 2, TypeScript 5.9 (strict, including `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`), Biome 2, Vitest 2, fast-check 3

## Testing

```bash
pnpm test                                          # all packages, fast tests
pnpm --filter @pf/rng-core test:stat               # 1M-round chi-square + uniqueness (slow)
pnpm --filter @pf/rng-core test:stat -- --testTimeout=300000
```

What gets tested:

- **rng-core**: 31 fast tests (HMAC determinism, rejection sampling, mapper correctness, edge cases) + 5 statistical tests (1M-round chi-square, dice mean / std, slot weighted-symbol distribution, 10K-nonce uniqueness for dice and cards).
- **seed-lifecycle**: 11 tests (commit / reveal cycle, hash chain integrity, append-only enforcement, auto-rotation limit, HMAC-recomputation invariant).
- **api**: 9 tests (auth, full flow, cross-tenant denial, role gates, OpenAPI spec).
- **verifier**: 3 tests (round reproduction, commitment mismatch detection, result tampering detection).

Total, 59 tests across the workspace. TypeScript strict-mode clean.

## Project layout

```
provably-fair-rng/
├── apps/
│   ├── api/                 # Hono server + OpenAPI 3.1 spec
│   └── verifier/            # static React UI
├── packages/
│   ├── rng-core/            # HMAC-SHA256 engine, mappers, commitment
│   └── seed-lifecycle/      # seed manager, audit log, hash chain
├── package.json             # workspace root
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

## Compliance

The verifier UI ships a **Compliance** page that maps each requirement from UKGC RTS, MGA, GLI-19 v3.0, Gibraltar RTOS, Sri Lanka GRA Act No. 17/2025, GDPR, and WCAG 2.2 AA to the specific file or function in the codebase that satisfies it.

For Sri Lanka specifically: the GRA's technical sub-regulations (specific algorithms, retention schedules, certified labs) had not been published as of May 2026. The implementation tracks GLI-19 as the closest published proxy, and the architecture is built to retrofit when sub-regulations are issued.

## Status

- **v0.1.0**, reference implementation. All four deliverables from the PRD are complete and tested.
- Persistence is in-memory by default. The `SeedPairStore` interface is wired to support a PostgreSQL implementation, planned for v0.2.
- Production readiness: the cryptographic core is solid; the operational layer (HSM / KMS for active seeds, observability, rate-limiting middleware) needs deployment-specific wiring.

## License

MIT. See [`LICENSE`](./LICENSE).

## Contributing

Issues and PRs welcome, please open an issue first to discuss substantial changes. The project has a strict statistical-test suite, any change touching the RNG core must keep all distribution tests green.
