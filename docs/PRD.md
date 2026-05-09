# Project 1 — Provably Fair RNG Engine with Verification UI
## Product Requirements Document (PRD)
### MECE Specification — What Needs to Exist

---

*Document Purpose: Define every component, behavior, data contract, and constraint
that must exist for this system to be complete and regulatorily credible.
This document is the input to engineering. It does not specify implementation.*

*Regulatory Sources: Gibraltar RTOS v1.1, UKGC RTS, MGA Technical Standards,
GLI Certification Framework, GRA Act No. 17 of 2025 (Sri Lanka)*

---

## MECE CHAPTER MAP

| # | Chapter | Covers | Excludes |
|---|---------|--------|----------|
| 1 | Cryptographic Core | Entropy sources, hashing algorithm, input schema | How seeds are managed over time |
| 2 | Mapping Layer | Raw hash → game value conversion, bias prevention | Where inputs come from |
| 3 | Commitment & Revelation Protocol | The trust handshake mechanism | How outputs become game values |
| 4 | Seed Lifecycle Management | Creation, storage, rotation, expiry of all seeds | The hashing computation itself |
| 5 | Verification Interface | Player-facing proof tool, all UI states | Backend data generation |
| 6 | Audit & Evidence Layer | Regulatory logging, reporting outputs | Player-facing display |
| 7 | Failure, Recovery & Constraint Specification | What system must do when things break; what it must never do | Normal operation |

---

## CHAPTER 1 — THE CRYPTOGRAPHIC CORE

### What Must Exist: The Entropy Architecture

The system requires three inputs that together constitute a single round's entropy: a Server Seed, a Client Seed, and a Nonce. No single party controls all three inputs simultaneously. This three-party entropy structure is the architectural mechanism through which neither the operator nor the player can determine or manipulate a game outcome before it is fixed.

The Server Seed is a high-entropy string generated exclusively by the system before any game session begins. It must be generated using a cryptographically secure pseudo-random number generator (CSPRNG) — the class of generator specifically designed to resist prediction even by an attacker with knowledge of previous outputs. This is the property that regulators term "unpredictability" under the MGA, UKGC, and GLI RNG testing frameworks. The Server Seed must have a minimum entropy of 256 bits, equivalent to a string of at least 64 hexadecimal characters. This length requirement is not aesthetic — it is the threshold at which brute-force discovery of the seed becomes computationally infeasible within any realistic operational timeframe, satisfying the "period length" requirement in RNG certification frameworks.

The Client Seed is a string supplied by the player's device at the start of a session. The system must accept any Client Seed the player provides, including a system-generated default if the player does not supply one. The player must be able to change their Client Seed at any point between game rounds. The Client Seed's purpose is to bind the player's own randomness contribution to the output — ensuring the operator cannot pre-compute outcomes after the player's behavior is known. This is the cryptographic equivalent of requiring the player to cut the deck.

The Nonce is a sequential integer that begins at zero at the start of each seed pair's lifetime and increments by exactly one for every game round played. It must never be reused within the same Server Seed and Client Seed pair. Its function is to guarantee that every round produces a unique output even when the same seed pair is active across multiple consecutive rounds. A seed pair active for one thousand rounds must produce one thousand distinct, non-repeating outputs.

### What Must Exist: The Hashing Function

The system must use HMAC-SHA256 as its sole hashing function for producing game outcomes. HMAC (Hash-based Message Authentication Code) with SHA-256 is the standard specified in NIST FIPS 198-1 and described in RFC 4868. It is the function referenced in current industry documentation from Chainlink, GameLabs International, and leading Provably Fair operators including Stake and BC.Game. The specific construction is: the Server Seed functions as the HMAC key, and the concatenation of Client Seed, colon separator, Nonce, colon separator, and Cursor (defined in Chapter 2) functions as the HMAC message. This construction produces a 256-bit (64 hexadecimal character) deterministic output for any given set of inputs. "Deterministic" means the same inputs always produce the same output — a property that is the foundation of player verification.

The system must not use raw SHA-256 without HMAC keying. Raw SHA-256 does not authenticate the source of the data; HMAC-SHA256 binds the output to the Server Seed as a key, ensuring that the output cannot be reproduced without knowledge of the Server Seed. This distinction directly addresses the Gibraltar RTOS requirement that RNG outputs be produced by a mechanism that cannot be reverse-engineered or pre-computed by an external party.

---

## CHAPTER 2 — THE MAPPING LAYER

### What Must Exist: The Raw-to-Game-Value Conversion

The HMAC-SHA256 output is a 256-bit hexadecimal string. It is not a game result. Converting it into a usable game value — a number between 0 and 99 for a dice game, a card from a 52-card deck, a symbol position on a slot reel — is the process that Gibraltar's RTOS formally defines as "mapping." The RTOS defines mapping as "the process by which the scaled number produced by an RNG is given a symbol or value that is usable and applicable to the current game." The mapping layer is a distinct and separately auditable component of the system, independent of the RNG core.

The system requires a configurable mapping module that accepts a raw HMAC-SHA256 output and a game-type specification, and returns a game value. The mapping module must be designed so that every possible game value in a given game's range has an equal probability of being produced. This property — uniform distribution across the output range — is the mathematical expression of fairness, and it is the property that GLI certification frameworks test when evaluating RNG implementations.

### What Must Exist: Bias Prevention via Rejection Sampling

A naive implementation of mapping introduces modulo bias. When a 256-bit value is reduced to a smaller range using a modulo operation, the values in the lower portion of the range are produced slightly more frequently than those in the upper portion, whenever the total range does not divide evenly into 2^256. For most practical game ranges, this bias is small but non-zero — and it is non-zero by a deterministic, predictable amount. A regulatorily credible RNG implementation must eliminate this bias entirely.

The system must implement rejection sampling as its bias-elimination mechanism. Under rejection sampling, the system defines a maximum acceptable value for the raw integer (the largest value that maps evenly into the target range without remainder). If the drawn value exceeds this maximum, that draw is discarded, and the system advances the Cursor by one and retakes the draw using the next 8-byte segment of the same HMAC output. This Cursor value is the fourth input to the HMAC construction described in Chapter 1. The rejection loop must continue until a value within the acceptable range is drawn. For all game ranges used in standard iGaming (dice, cards, roulette, slots), the rejection probability is below 0.001%, meaning the practical performance impact is negligible.

### What Must Exist: Game-Type Mapping Specifications

The system must include pre-defined mapping specifications for three game archetypes, sufficient to demonstrate the complete mapping layer in operation. The first archetype is a continuous range game (dice or crash), where the output is a floating-point number between 0 and 1, scaled to the game's declared range. The second archetype is a discrete unordered set (standard 52-card deck), where the output is a card identity — suit and value — drawn without replacement. For a full deck shuffle, the system draws 52 separate values using 52 incremented Cursor positions, discarding duplicates via rejection. The third archetype is a weighted symbol set (slot reel), where the output maps to one of N symbols with explicitly defined, non-uniform probability weights. The mapping layer must accept these weights as configuration and produce the correct long-run frequency for each symbol as verified by statistical testing over a minimum of one million simulated rounds.

---

## CHAPTER 3 — THE COMMITMENT & REVELATION PROTOCOL

### What Must Exist: The Pre-Game Commitment

Before a player places their first bet in a session, the system must deliver a commitment to the Server Seed in the form of its SHA-256 hash. The player receives the hash of the Server Seed — not the Server Seed itself — before any game round begins. This commitment has two effects. First, it proves that the Server Seed was fixed before the player's bets were placed, eliminating the possibility that the operator selected or modified the Server Seed after observing the player's behavior. Second, it creates a verifiable contract: after the Server Seed is revealed at session end, the player can independently confirm that SHA-256(revealed Server Seed) equals the commitment hash they received at session start.

The commitment hash must be displayed to the player in the game interface before the first round is played. It must not be hidden in settings menus or require the player to request it. It must be present in the round-level audit log (described in Chapter 6). The commitment mechanism is the cornerstone of the system's regulatory credibility — without it, the Provably Fair label is technically meaningless, because a system without pre-game commitment provides no protection against post-hoc seed selection.

### What Must Exist: The Seed Rotation Trigger

The Server Seed must change — and the old seed must be revealed — under two conditions. The first is player-initiated: any player must be able to request a new Server Seed at any time between rounds. Upon this request, the current Server Seed is revealed in full, a new Server Seed is generated, and its hash commitment is delivered before the next round begins. The second is system-initiated: the Server Seed must automatically rotate after a configurable maximum number of rounds (default: 10,000) to prevent any seed pair from accumulating so large a game history that statistical analysis of outputs becomes computationally feasible.

When a seed rotation occurs, the system must produce a rotation event record containing the revealed Server Seed, the SHA-256 hash of that seed (for backward verification), the final Nonce value at the point of rotation, and a timestamp. This rotation record is part of the audit log (Chapter 6) and must be accessible to the player for any seed pair they have played with.

### What Must Exist: The Revelation Event

At the end of a seed pair's operational life — whether triggered by the player or by the automatic rotation limit — the system must reveal the full Server Seed to the player. This revelation must be permanent: once a Server Seed is revealed, it must remain accessible in the player's session history indefinitely. The revelation record is the player's primary instrument for independent verification. A system that reveals seed values but does not retain them in accessible history provides only the illusion of verifiability.

---

## CHAPTER 4 — SEED LIFECYCLE MANAGEMENT

### What Must Exist: Seed Generation Standards

Server Seeds are generated by the system's CSPRNG at two moments: when a new player session begins, and when a seed rotation event occurs. Each Server Seed must be unique across all sessions and all time — the system must maintain a uniqueness constraint on Server Seed values. Generation must occur server-side only; no component of the Server Seed is derived from client-supplied data. The CSPRNG used must be the platform's operating system-level secure random source (e.g., /dev/urandom on Linux, CryptGenRandom on Windows) rather than application-level pseudo-random functions, which are not suitable for security-sensitive generation.

Client Seeds generated by the system as defaults must also be produced by a CSPRNG, not a deterministic sequence. A player-supplied Client Seed of any string content is valid. The system must accept an empty Client Seed and treat it as an empty string input to the HMAC function — it must not substitute a default value silently, as this would undermine the player's understanding of what was used to produce their outcomes.

### What Must Exist: Seed Storage Requirements

The active Server Seed must be stored in a form that is inaccessible to players during its operational life and accessible only to the system process that computes HMAC outputs. It must not appear in any client-facing API response, log file, or UI element until the moment of revelation. The hash commitment of the active Server Seed must be accessible to the player at all times during the seed's operational life.

All revealed Server Seeds, their hash commitments, the associated Client Seed, the final Nonce value, and all game outcomes produced during that seed pair's lifetime must be retained in storage for a minimum of 12 months. This retention period aligns with the MGA's monthly reporting obligations and the UKGC's audit access requirements, both of which require operators to produce historical outcome data on demand. Under the GRA Act No. 17 of 2025, software systems must maintain certified algorithms with auditable output histories — this retention architecture is the mechanism through which that requirement is satisfied.

### What Must Exist: Nonce Management

The Nonce for each seed pair begins at zero and increments by exactly one per round. The system must store the current Nonce value persistently — a server restart must not reset the Nonce for an active seed pair. The current Nonce value must be visible to the player in the game interface at all times, enabling them to independently reconstruct any historical outcome from the inputs alone. The Nonce must never be reused within a seed pair. Once a seed pair is retired through rotation, its Nonce history is fixed and must be preserved for the retention period.

---

## CHAPTER 5 — THE VERIFICATION INTERFACE

### What Must Exist: The Verification Tool

The verification interface is a standalone web page or embedded game panel that enables any person — player, regulator, or auditor — to independently verify the fairness of any historical game outcome using only the inputs to the HMAC function. It requires no registration, no login, and no trust in the operator's systems. Its function is to reproduce, from first principles, the outcome that the system produced for a given set of inputs, and to confirm that this reproduction matches the recorded outcome.

The verification tool must accept four inputs: the revealed Server Seed, the Client Seed, the Nonce, and the game type. The game type selection determines which mapping specification (Chapter 2) is applied to convert the HMAC output into a game result. The tool must display the intermediate outputs of each processing step — the raw HMAC-SHA256 hex string, the rejection sampling process if applicable, the final scaled value, and the mapped game result — so that the verification is transparent at every stage, not just at the final output.

### What Must Exist: The Game History Panel

Every player session must include a game history panel that displays, for each completed round: the round number (Nonce value), the game outcome, the active Server Seed hash commitment, the Client Seed used, and a direct link to verify that round in the verification tool. The history panel must retain the complete history of all seed pairs used during the session, including pairs that have been rotated and revealed. For each revealed seed pair, the actual Server Seed must be displayed alongside its hash commitment, enabling the player to confirm that the commitment matches the revelation without using the verification tool.

### What Must Exist: The Commitment Display

The current Server Seed hash commitment must be displayed in the active game interface at all times — not only in the history panel. Its position in the UI must be consistent and non-intrusive, but always present. The UKGC's transparency principle, as applied in its RTS framework, requires that players have continuous access to the information relevant to their current session. The hash commitment satisfies this requirement for the RNG layer: it is the player's real-time evidence that the outcome of the next round has already been committed to and cannot be altered.

### What Must Exist: The Simulation Mode

The verification interface must include a simulation mode that allows any user to generate synthetic game outcomes using custom inputs, without connecting to a live game session. Simulation mode accepts a user-specified Server Seed, Client Seed, starting Nonce, round count, and game type, and produces the complete outcome sequence for that parameter set. This mode serves two purposes. First, it demonstrates the determinism of the system — the same inputs always produce the same sequence, making the verification proof self-evident. Second, it enables B2B buyers and regulators to test the mapping layer against expected distributions without requiring access to a live deployment.

---

## CHAPTER 6 — THE AUDIT & EVIDENCE LAYER

### What Must Exist: The Round-Level Log

Every game round must produce a round-level log record at the moment the outcome is determined, before the outcome is communicated to the player. The record must contain: the session identifier, the round timestamp (UTC, millisecond precision), the Server Seed hash commitment active at the time of the round, the Client Seed, the Nonce, the raw HMAC-SHA256 output, the Cursor value used (if rejection sampling was invoked), the mapped game value, and the game type. This record is immutable — it must not be modifiable after creation, and the system must not permit deletion of round records within the retention period.

The round-level log is the regulatory evidence layer. Under the MGA's audit logging requirements, all changes to game outcome data must be logged. The round-level log does not record changes — it records the original determination — but it provides the baseline against which any alleged modification could be detected, because the log entry's HMAC output can be independently recomputed from its recorded inputs and must match. Any discrepancy between the logged HMAC output and the recomputed value proves tampering.

### What Must Exist: The Seed Pair Summary Report

At the end of each seed pair's operational life, the system must produce a seed pair summary report. This report contains the revealed Server Seed and its SHA-256 hash, the Client Seed, the total number of rounds played, the Nonce range (0 to final Nonce), the aggregate outcome distribution by game type (for statistical validation), and the rotation trigger (player-initiated or automatic). This report is the unit of evidence that an independent auditor uses to validate the RNG's performance over a defined operational period. Its aggregate outcome distribution is the data from which RTP deviation analysis (as required under the UKGC's standing live RTP monitoring condition) is performed.

### What Must Exist: The API for Regulatory Access

The system must expose a read-only API endpoint that returns, for any queried round identifier or seed pair identifier, the complete round-level log record or seed pair summary report. This endpoint is the mechanism through which a regulator, auditor, or licensed testing laboratory accesses the system's evidence without requiring access to the production database directly. Under the GRA Act's software certification requirement, gambling software algorithms must be accessible to the prescribed authority for verification. This API is the technical implementation of that accessibility obligation. The endpoint must be authenticated — access requires an API key — but the key issuance process must be documentable for regulatory submission.

---

## CHAPTER 7 — FAILURE, RECOVERY & CONSTRAINT SPECIFICATION

### What the System Must Do When the RNG Fails

If the CSPRNG fails to generate a Server Seed — due to entropy pool exhaustion, hardware failure, or software fault — the system must halt all new game sessions immediately. It must not substitute a fallback seed-generation method, degrade to a weaker randomness source, or continue operating with a default value. The failure must be logged as a critical system event with a timestamp and the nature of the failure. No game round may be initiated until a valid Server Seed has been generated by the CSPRNG and its hash commitment delivered to the player.

If a failure occurs mid-round — after the round has been initiated but before the outcome has been communicated to the player — the system must preserve the round-level log record that was created at the moment of outcome determination (before communication). Upon recovery, the system must communicate the preserved outcome to the player, not generate a new outcome. This behavior is the technical implementation of the principle established across MGA, UKGC, and Gibraltar RTOS frameworks: RNG failure recovery must restore to a known secure state without losing the record of the game's progress at the point of failure.

### What the System Must Do When the Client Seed Is Absent

If the player's device fails to supply a Client Seed, the system must use a CSPRNG-generated default Client Seed and must notify the player that a system-generated Client Seed is active. The system must not silently substitute a fixed or predictable string. The player must be able to replace the system-generated Client Seed at any time before the next round. The system must record in the round-level log whether the Client Seed was player-supplied or system-generated, so that this distinction is preserved in the audit trail.

### What the System Must Never Do — The Hard Constraints

There are six behaviors that the system must never exhibit, regardless of implementation approach, performance optimization, or operational convenience.

The system must never generate a game outcome before both the Client Seed and the Nonce for that round are known. Generating an outcome before the Nonce is fixed would break the uniqueness guarantee. Generating an outcome before the Client Seed is fixed would allow the operator to select the outcome after observing the player's seed contribution.

The system must never use the same Server Seed for two separate sessions without first rotating it and revealing the previous seed. A Server Seed shared across sessions allows cross-session correlation of outcomes, undermining the independence guarantee.

The system must never reveal a Server Seed before the final round using that seed has been completed. Early revelation allows a player or operator with knowledge of the Server Seed to compute future outcomes, destroying the unpredictability property.

The system must never apply a mapping function that produces unequal output probabilities without this being explicitly declared as a weighted mapping configuration. Undeclared non-uniform distributions are what Gibraltar's RTOS terms a "biased mapping table" — a game that is mathematically unfair even if the RNG source is statistically valid.

The system must never modify a round-level log record after it has been created. Modification of historical records, even corrective modification, destroys the audit trail's evidentiary value and would constitute the type of tampering that the immutable log architecture is specifically designed to make detectable.

The system must never expose the active (unrevealed) Server Seed in any client-facing response, log output, error message, or debugging interface. Accidental exposure before revelation invalidates the commitment protocol for all future rounds in that seed pair's lifetime.

---

## DELIVERABLE SPECIFICATION — What the Completed Project Produces

The completed project consists of four deliverable components that together constitute a demonstrable, regulatorily credible Provably Fair RNG Engine.

The first component is the RNG Core Library: a standalone, dependency-minimal module that accepts a Server Seed, Client Seed, Nonce, and Cursor as inputs and returns a deterministic HMAC-SHA256 output. It includes the rejection-sampling mapper and the three game-type mapping specifications. It is documented with input/output contracts and includes a self-contained test suite that verifies: known-input/known-output correctness, rejection sampling behavior, uniform distribution over one million rounds, and uniqueness of outputs across ten thousand sequential Nonces.

The second component is the Seed Lifecycle Manager: a service layer that manages Server Seed generation, hash commitment production, Nonce tracking, rotation triggers, and seed revelation. It enforces all constraints from Chapter 4 and produces the round-level log records and seed pair summary reports defined in Chapter 6.

The third component is the Verification Interface: a web-accessible tool implementing all requirements from Chapter 5, including the four-input verification form, step-by-step intermediate output display, game history panel, commitment display, and simulation mode. It must be deployable as a static site with no server-side dependency for the verification computation itself — the HMAC-SHA256 computation must execute client-side in the browser, so that the verification is provably independent of the operator's infrastructure.

The fourth component is the Regulatory API: the read-only, authenticated endpoint specified in Chapter 6, returning round-level and seed pair records in a structured, machine-readable format suitable for submission to an independent testing laboratory or regulatory authority.

---

## DEPENDENCY MAP

| Chapter | Depends On | Required Before |
|---------|-----------|-----------------|
| 1 — Cryptographic Core | Nothing | All other chapters |
| 2 — Mapping Layer | Chapter 1 (HMAC output as input) | Chapter 5 (verification), Chapter 6 (audit) |
| 3 — Commitment & Revelation | Chapter 1 (hash of Server Seed), Chapter 4 (seed storage) | Chapter 5 (commitment display) |
| 4 — Seed Lifecycle Management | Chapter 1 (CSPRNG generation standard) | Chapter 3 (rotation events), Chapter 6 (retention) |
| 5 — Verification Interface | Chapters 1, 2, 3, 4 (all inputs must exist before UI can display them) | Nothing |
| 6 — Audit & Evidence Layer | Chapters 1, 2, 3, 4 (all round data must exist before it can be logged) | Nothing |
| 7 — Failure & Constraints | All chapters (defines boundaries for all of the above) | All chapters (must inform design of each layer) |

---

*End of PRD — Project 1: Provably Fair RNG Engine with Verification UI*
*Feed this document to Claude Code as the specification input.*
*Do not modify the constraint specifications in Chapter 7 without regulatory review.*
