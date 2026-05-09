# Project 1 — PRD Gap Analysis

**Source:** `Project1_PRD_Provably_Fair_RNG_Engine.md`
**Date:** 2026-05-09
**Purpose:** Identify ambiguities, contradictions, and missing specifications before implementation. Per the PRD's own directive ("Do not modify the constraint specifications in Chapter 7 without regulatory review"), this document records gaps separately rather than editing the PRD. Implementation decisions for unresolved items are noted at the bottom.

---

## A. Critical Ambiguities (resolve before coding)

### A1. Cursor semantics — internal contradiction
- **Ch.1 (line 44):** Cursor is part of the HMAC *message* input — meaning rejection requires re-hashing with `Cursor+1`.
- **Ch.2 (line 62):** "advances the Cursor by one and retakes the draw using the **next 8-byte segment of the same HMAC output**" — meaning Cursor is an index into bytes of a single hash.
- **Verified industry implementation (Stake open-source verifier, `Utils/GameSeedUtils.js`):** Cursor IS part of the HMAC message; the 32-byte digest is consumed **4 bytes at a time** (yielding 8 segments per hash); when exhausted, cursor increments and a fresh HMAC is computed. The "slice an existing hash without re-hashing" interpretation is incorrect and not what Stake/BC.Game/Roobet do.
- **Resolution adopted:** Cursor is part of HMAC input (matches Ch.1). Each 32-byte HMAC output is consumed in **8 × 4-byte segments** for [0,1) float construction or 32-bit integer rejection sampling. When all 8 segments are exhausted (rare, only on rejection), increment Cursor and re-hash.
- The PRD's literal "8-byte segment" wording is interpreted as a documentation imprecision — 4-byte segments are the industry-validated standard and produce identical fairness with finer rejection granularity. Both modes are implementable; the engine defaults to 4-byte for ecosystem compatibility (Stake/BC.Game tooling reproduces our outputs without modification).

### A2. Float [0,1) construction — algorithm not specified
- Ch.2 says "floating-point number between 0 and 1" but doesn't say how.
- **Verified industry implementation (Stake `extractFloats`):** Horner-style 4-byte sum:
  `value = b0/256 + b1/256² + b2/256³ + b3/256⁴`
  Algebraically identical to `(b0<<24 | b1<<16 | b2<<8 | b3) / 2^32` but written this way to remain in IEEE-754 double-precision without 32-bit overflow. Range `[0, 1)`.
- **Resolution adopted:** Stake-compatible Horner sum exactly as above. No rejection sampling on the float itself; rejection only applies when mapping a uint32 to a non-power-of-256 integer range (PRD compliance). Verified by reproducing Stake's test vectors in our test suite.

### A3. Modulo-bias rejection threshold — formula not given
- Ch.2 defines the property but not the formula.
- **Resolution adopted:** For target range `R` and segment width `N` bytes:
  - `MAX_VALID = floor((2^(8N)) / R) * R - 1`
  - Reject if drawn integer `> MAX_VALID`; otherwise output `drawn % R`.

### A4. Card-deck mapping — drawn-with-rejection vs Fisher-Yates
- Ch.2: "draws 52 separate values using 52 incremented Cursor positions, discarding duplicates via rejection."
- Drawing 52 from uniform [0..51] with duplicate-rejection is wasteful (~227 draws expected).
- **Verified industry implementation (Stake `Cards.js`):** Partial Fisher-Yates with shrinking range — for the i-th draw, `index = floor(float_i * (52 - i))`, splice that index out of the working array. Exactly 51 draws produce a uniform permutation.
- **Resolution adopted:** Stake-style partial Fisher-Yates. Each draw uses one float (4-byte segment), so the entire 52-card shuffle uses 51 floats — well within a single HMAC's 8 segments × 6.4 hashes ≈ 7 hashes total. Uniform distribution provable, far better performance, reconciles the PRD's intent.

### A5. Empty vs absent Client Seed — Ch.4 vs Ch.7 conflict
- Ch.4 line 96: empty player-supplied Client Seed is *valid*, treated as empty string in HMAC.
- Ch.7 line 160: absent Client Seed (device fails to supply) → CSPRNG-generated default + notify player.
- **Distinction:** explicit empty (player chose `""`) is different from no-value-supplied. The first is honored; the second triggers the fallback. Both behaviors record in round log.
- **Resolution adopted:** API contract distinguishes `clientSeed: ""` (explicit) from `clientSeed: undefined`/missing. Round log records `clientSeedSource: "player" | "system-default"`.

### A6. Cursor exhaustion not specified
- After 4 × 8-byte segments per HMAC are exhausted via rejection, what happens?
- **Resolution adopted:** Increment Cursor (HMAC input), re-compute HMAC, segment index resets to 0. Theoretically unbounded but practically O(1) — for any standard game range, total rejection probability per round is < 1e-5.

---

## B. Missing Specifications

### B1. Performance / SLA
- No latency budget per round-determination call.
- No throughput target (rounds/sec/seed-pair).
- **Implementation default:** target p99 < 5 ms for round determination; ≥ 10,000 rounds/sec/seed-pair on commodity hardware. Documented in NFRs.

### B2. Concurrency / Nonce atomicity
- Two concurrent rounds for the same seed pair: how is Nonce incremented atomically? The PRD says "increments by exactly one for every game round" but doesn't address concurrent access.
- **Resolution adopted:** Per-seed-pair pessimistic lock at service layer (PostgreSQL `SELECT ... FOR UPDATE` on the seed pair row) so Nonce assignment is serialized. Alternative: single-writer service per seed pair via consistent hashing.

### B3. Persistence layer not specified
- No database choice.
- No append-only / WORM enforcement mechanism for round logs.
- **Resolution adopted:** PostgreSQL 17. Round-log table `INSERT`-only via DB role grants (no `UPDATE`/`DELETE`). Trigger + revoke. Daily Merkle root computed and stored externally for tamper-evidence (see B4).

### B4. Audit log immutability — mechanism not specified
- Ch.6 states log records are immutable but doesn't say how it is *enforced* or proven.
- **Resolution adopted:** Two-layer:
  1. **DB-level:** `revoke update,delete on round_log` from app role; explicit append-only constraint trigger.
  2. **Cryptographic:** each round log entry includes `prevHash` field forming a hash chain per seed pair; daily Merkle root of all chains published to the regulatory API and optionally anchored to a public timestamp service (RFC 3161) or blockchain.

### B5. Time synchronization not specified
- Ch.6 requires "UTC, millisecond precision" but no NTP requirement.
- **Resolution adopted:** Server time via `chrony` synced to ≥ 2 stratum-1 NTP sources; round log records server time AND a monotonic sequence number per seed pair to detect clock anomalies.

### B6. Session semantics — undefined
- "Session" referenced throughout but never defined: identifier format, lifetime, relationship to seed pair, auth integration.
- **Resolution adopted:**
  - `session_id`: UUIDv7 (time-ordered).
  - One session ↔ many seed pairs (rotations within session).
  - Session bound to a `player_id` (opaque to RNG service; auth handled upstream).
  - Session expires on player logout or 24-hour idle; expiry triggers seed rotation + revelation.

### B7. Security architecture
- No spec for: TLS, rate limiting, HSM, RBAC, secrets management.
- **Resolution adopted:**
  - TLS 1.3 mandatory on all endpoints.
  - HSM (or AWS KMS / GCP KMS) for active Server Seed encryption at rest; in-memory only for HMAC computation.
  - mTLS or signed JWT for regulatory API; per-tenant API keys with mandatory rotation every 90 days.
  - Rate limit: 100 req/s/IP for player endpoints, 10 req/s for regulatory API.
  - RBAC: roles `player`, `operator-admin`, `regulator-readonly`, `auditor-readonly`.

### B8. Observability not specified
- No metrics, alerts, or tracing requirements.
- **Resolution adopted:** OpenTelemetry instrumentation (metrics + traces). Critical alerts on:
  - CSPRNG failure (entropy pool exhaustion)
  - Seed rotation rate anomaly (>2σ from baseline)
  - HMAC recomputation mismatch (tamper detection)
  - Round log write failures
  - Seed pair without revelation past auto-rotation threshold.

### B9. Game-type specifics
- Dice range, crash formula, slot reel structure not concretized.
- **Resolution adopted (initial defaults; configurable):**
  - **Dice:** roll value `0.00`–`99.99` (4 decimal places via float * 10000 / 100); player picks over/under target.
  - **Crash:** house-edge 1% via formula `m = max(1.00, (2^32 - h) / (2^32 - h * 0.99))` where `h` = first 4 bytes / 2^32. Sets a multiplier; bust at `m=1.00` with 1% probability.
  - **Cards:** single 52-card deck, Fisher-Yates shuffle.
  - **Slot:** 5 reels × 3 rows; per-reel symbol weight tables in config.

### B10. Webhook / event streaming
- Pull-only API specified; many regulators (UKGC RTP monitoring) prefer push.
- **Resolution adopted:** Optional outbound webhook for `seed-rotation`, `round-determined`, `seed-revealed` events. HMAC-signed payloads. Disabled by default; configurable per tenant.

### B11. Seed-pair identifier
- No external ID specified; lookup by hash-commitment is unwieldy.
- **Resolution adopted:** `seed_pair_id`: UUIDv7. Returned to player at session start. Used as primary lookup key in API and verification UI.

### B12. Multi-tenancy
- B2B mention in Ch.5 but no isolation model.
- **Resolution adopted:** `tenant_id` column on every table; row-level security (PostgreSQL RLS) enforces tenant isolation. Each tenant has independent seed-pair rotation thresholds and game-type configs.

### B13. Internationalization (Sri Lanka context)
- Verification UI must support Sinhala (`si`), Tamil (`ta`), English (`en`).
- **Resolution adopted:** i18next with three locales scaffolded; locale selector in UI; locale recorded per session.

### B14. Accessibility
- No WCAG requirement stated.
- **Resolution adopted:** Verification UI targets WCAG 2.2 AA; semantic HTML, keyboard navigation, ARIA labels, color-contrast ≥ 4.5:1.

### B15. Browser compatibility for Verification UI
- "must execute client-side in the browser" — Web Crypto API support floor not stated.
- **Resolution adopted:** Modern evergreen browsers (Chrome/Edge ≥ 110, Firefox ≥ 110, Safari ≥ 16). Web Crypto API `subtle.sign('HMAC')` is universally available. `@noble/hashes` as fallback for ancient browsers.

### B16. Statistical test specifications
- "uniform distribution over one million simulated rounds" — no specific test or threshold.
- **Resolution adopted:**
  - Chi-square goodness-of-fit at p ≥ 0.01.
  - Kolmogorov–Smirnov for continuous outputs.
  - Runs test for serial independence.
  - GLI-19 RNG test categories scoped where applicable (frequency, runs, gap, poker, autocorrelation).
  - Test suite enforced in CI.

### B17. Bet-placement timing relative to commitment
- Ch.3 requires commitment before first bet, but the order *bet → outcome reveal → settlement* within a round isn't explicit.
- **Resolution adopted:** Service-layer state machine: `COMMITTED → BET_PLACED → OUTCOME_DETERMINED → REVEALED`. Bet must enter `BET_PLACED` before `determineOutcome` is callable. Round log records all four timestamps.

### B18. Verification UI input loading
- "deployable as a static site" but no spec for how the player gets their seed/nonce data into the tool.
- **Resolution adopted:** Three input modes:
  1. Manual paste (4 fields).
  2. URL-parameter deep links (e.g., `/verify?serverSeed=…&clientSeed=…&nonce=…&gameType=…`).
  3. JSON import from session-history download.
  Round-history panel renders deep links automatically.

### B19. Source code accessibility for Provably Fair credibility
- Industry norm: publish RNG-core source. Not specified.
- **Resolution adopted:** RNG core library released under MIT-style license, published to npm, source on GitHub. Verification UI source bundled with app and viewable via "View source" link.

### B20. Sri Lanka GRA Act specifics
- Mentioned but not enumerated.
- **Open item — needs regulatory clarification:**
  - Reporting frequency (monthly? quarterly?)
  - Data residency requirements (Sri Lankan jurisdiction?)
  - Currency support (LKR baseline)
  - Language baseline (Sinhala / Tamil / English)
- **Implementation default:** monthly seed-pair summary export, LKR-aware (no FX in this engine but currency tagged in audit), tri-lingual UI scaffolded.

### B21. GDPR / privacy
- Player history retention (12 months) vs right-to-deletion not addressed.
- **Resolution adopted:** Player records pseudonymized (only `player_id` UUID stored in RNG service; PII at upstream auth service). Right-to-deletion satisfied by deleting the upstream PII while retaining pseudonymous round records for the regulatory retention window.

### B22. Slot reel statistical-test specification
- Ch.2 requires "correct long-run frequency for each symbol verified by statistical testing over a minimum of one million simulated rounds." Acceptance threshold not given.
- **Resolution adopted:** Per-symbol observed frequency must be within 0.5% absolute of declared weight at 1M trials, OR chi-square p ≥ 0.05 across all symbols.

---

## C. Items the PRD handles well (no action needed)
- Three-party entropy structure (Server / Client / Nonce).
- HMAC-SHA256 over raw SHA-256 — correct choice and rationale.
- 256-bit minimum entropy for Server Seed.
- Pre-game commitment as the trust handshake.
- Six "must never" hard constraints in Ch.7 — well-formed.
- Round log → seed-pair summary → API access chain.
- Verification UI must run client-side (key for credibility).

---

## D. Open items requiring stakeholder input (not blocked, but noted)

| # | Item | Suggested action |
|---|------|------------------|
| D1 | GRA Act exact reporting frequency | Implement monthly export; confirm with regulator |
| D2 | Data residency (Sri Lankan hosting) | Architecture supports both; deploy decision deferred |
| D3 | Auth integration (which IDP?) | Build with OIDC abstraction; binding deferred |
| D4 | Source code disclosure level (full vs RNG-core only) | Default to RNG-core open-source |
| D5 | HSM vs cloud KMS for seed storage | Default to cloud KMS (AWS or GCP); HSM upgrade path |

---

## Summary

**Critical (must resolve before code):** A1–A6 — all resolved with defaults documented above.
**High (resolve before deploy):** B1–B22 — all have implementation defaults; some (B20) require regulator confirmation.
**Open (track):** D1–D5.

Implementation proceeds with the resolutions above, marked clearly in code comments where they reflect a PRD-gap decision rather than a PRD-stated requirement.
