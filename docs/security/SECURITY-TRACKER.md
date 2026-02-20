# Aegis Protocol Security Tracker

Last updated: 2026-02-20

## Purpose

This tracker is the canonical running log for security findings, remediation status, and follow-up hardening work.

- Detailed one-time audit narrative: `docs/security/security_best_practices_report.md`
- Ongoing status and ownership: `docs/security/SECURITY-TRACKER.md` (this file)

## Status legend

- `OPEN`: Finding is confirmed and not yet remediated.
- `IN_PROGRESS`: Fix work started, not fully verified.
- `MONITORING`: Fix shipped; monitor for regressions.
- `CLOSED`: Fix shipped and verified with tests.
- `ACCEPTED_RISK`: Known issue accepted with explicit rationale.

## Snapshot

- Open P0: 0
- Open P1: 0
- Open P2: 0
- Closed total: 6
- Backlog hardening items (non-finding): 3 (2 closed, 1 accepted risk)

## Findings register

| ID | Severity | Area | Summary | Detected | Status | Owner | Target date | Fixed date | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SEC-001 | P0 | Contracts | Permissionless factory path could spend approved client funds | 2026-02-20 | CLOSED | Unassigned | 2026-02-20 | 2026-02-20 | `src/AegisJobFactory.sol:151`, `test/AegisJobFactory.t.sol:286` |
| SEC-002 | P0 | Contracts | Re-validation hash not bound to dispute | 2026-02-20 | CLOSED | Unassigned | 2026-02-20 | 2026-02-20 | `src/AegisDispute.sol:269`, `test/AegisDispute.t.sol:462` |
| SEC-003 | P1 | Contracts | Arbitrator could unstake while assigned | 2026-02-20 | CLOSED | Unassigned | 2026-02-20 | 2026-02-20 | `src/AegisDispute.sol:327`, `test/AegisDispute.t.sol:576` |
| SEC-004 | P1 | Contracts | Dispute could be raised with unset dispute engine | 2026-02-20 | CLOSED | Unassigned | 2026-02-20 | 2026-02-20 | `src/AegisEscrow.sol:464`, `test/AegisEscrow.t.sol:520` |
| SEC-005 | P2 | API | GraphQL list params interpolated unsafely | 2026-02-20 | CLOSED | Unassigned | 2026-02-20 | 2026-02-20 | `api/src/routes/jobs.ts:53`, `api/tests/routes/jobs.test.ts:9` |
| SEC-006 | P2 | MCP | Hardcoded escrow address caused chain/config drift | 2026-02-20 | CLOSED | Unassigned | 2026-02-20 | 2026-02-20 | `mcp/src/tools/check-balance.ts:24`, `mcp/tests/tools/check-balance.test.ts:25` |

## Hardening backlog (non-finding upgrades)

| ID | Severity | Area | Summary | Status | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| BH-001 | P2 | Contracts | Timeout dispute split is static `50/50` and not wired to template policy | CLOSED | Unassigned | Dispute split snapshotted on Job struct at creation. `src/AegisEscrow.sol:304`, `src/AegisDispute.sol:413`, `test/AegisDispute.t.sol:test_ResolveByTimeout_UsesJobDisputeSplit`, `test/AegisEscrow.t.sol:test_CreateJob_SnapshotsDisputeSplit` |
| BH-002 | P2 | Contracts | Arbitrator selection entropy may be block-influenceable | ACCEPTED_RISK | Unassigned | VRF deferred to V2. Added 1-hour timing guard in `assignArbitrator` to advance entropy across L1 blocks. Base sequencer (Coinbase) has no incentive to game selection. `src/AegisDispute.sol:assignArbitrator`, `test/AegisDispute.t.sol:test_AssignArbitrator_RevertIfTooEarly` |
| BH-003 | Operational | CI/SecOps | Add recurring adversarial security checks (invariants + AI-assisted triage) | CLOSED | Unassigned | Added `[profile.ci]` to `foundry.toml`, 5 invariant tests (fund conservation, escrow solvency, state monotonicity, terminal permanence, job count), handler with 7 actions. CI workflow updated. `test/invariants/AegisInvariant.t.sol`, `test/invariants/handlers/AegisHandler.sol` |

## Verification log

| Date | Scope | Result | Notes |
| --- | --- | --- | --- |
| 2026-02-20 | `forge test` | PASS | 205 passed, 0 failed |
| 2026-02-20 | `cd api && ./node_modules/.bin/vitest run` | PASS | 26 passed, 0 failed |
| 2026-02-20 | `cd mcp && ./node_modules/.bin/vitest run` | PASS | 17 passed, 0 failed |
| 2026-02-20 | `forge test` (post BH-001/002/003 + custom errors) | PASS | 212 passed, 0 failed |
| 2026-02-20 | `forge test --match-path test/invariants/*` | PASS | 5 invariants, 256 runs each, 640k calls, 0 failures |

## Update process (for all agents)

1. Assign ID:
- Findings use `SEC-###` (increment by 1).
- Hardening tasks use `BH-###`.
2. Add a row in the appropriate table with severity, area, and evidence references.
3. Update status as work progresses (`OPEN` -> `IN_PROGRESS` -> `CLOSED`).
4. Add or refresh verification evidence in the verification log.
5. If behavior changes or risk interpretation changes, update `docs/security/security_best_practices_report.md`.

## Changelog

- 2026-02-20: Initialized tracker with SEC-001..SEC-006 and BH-001..BH-003.
- 2026-02-20: Closed BH-001 (dispute split wired to job/template), accepted BH-002 (timing guard added, VRF deferred), closed BH-003 (CI profile + 5 invariant tests). Migrated all string reverts to custom errors.
