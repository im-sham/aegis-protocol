# Aegis Protocol Engineering Risk Tracker

Last updated: 2026-03-04

## Purpose

This tracker is the canonical running log for non-security engineering and operational risks (for example: external dependencies, reliability, test environment drift, and infrastructure constraints).

- Security-specific findings: `docs/security/SECURITY-TRACKER.md`
- This file tracks broader engineering risks that can cause rework, flakiness, or delivery delays.

## Status legend

- `OPEN`: Risk confirmed and not yet mitigated.
- `IN_PROGRESS`: Mitigation work has started.
- `MONITORING`: Mitigation shipped; watching for recurrence.
- `MITIGATED`: Mitigation shipped and validated.
- `ACCEPTED_RISK`: Known risk accepted with explicit rationale.

## Snapshot

- Open P0: 0
- Open P1: 0
- Open P2+: 1
- Monitoring: 2
- Mitigated: 0
- Accepted risk: 0

## Risk register

| ID | Severity | Area | Summary | Detected | Status | Owner | Mitigation in place | Monitoring signal | Next action | Last reviewed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OPS-001 | P1 | MCP / External RPC | Public Base Sepolia RPC endpoints intermittently timeout (`ETIMEDOUT`, `EHOSTUNREACH`) causing false-negative MCP E2E failures and occasional write failures. | 2026-02-27 | MONITORING | Unassigned | E2E retries + nested error-cause transient detection are in place, runtime failover is implemented via prioritized RPC lists (`AEGIS_RPC_URLS`) in MCP/SDK transport setup, CI workflow is wired for primary/secondary RPC secrets with trusted-event + protected-environment gating, and reliability runbook is documented. Evidence: `mcp/tests/e2e/mcp-e2e.test.ts`, `mcp/src/sdk-client.ts`, `sdk/packages/sdk/src/client.ts`, `.github/workflows/test.yml`, `docs/operations/RELIABILITY-RUNBOOK.md`. | Any transport-related retry/failure in MCP E2E runs. | Replace current RPC secret values with dedicated provider endpoints, then run protected `mcp-e2e` on `main` and log pass/failure evidence. | 2026-03-04 |
| OPS-002 | P2 | Test Infra / Funding | Repeated live E2E runs consume gas and escrowed USDC on the signer wallet, which can eventually block tests or produce misleading failures. | 2026-02-27 | OPEN | Unassigned | `aegis_check_balance` assertions provide visibility into spend trend each run. | USDC balance/allowance below required thresholds for test flow. | Define minimum balance guardrails and add top-up/approval runbook step before CI-like E2E runs. | 2026-02-27 |
| OPS-003 | P1 | CI Governance | Protected environment approval flow can deadlock if the only reviewer is also prevented from self-review. | 2026-03-04 | MONITORING | Unassigned | `testnet-e2e` was updated to `prevent_self_review=false` while retaining required reviewer + `main` branch policy. | `mcp-e2e` approval stalls or unexpected bypass behavior. | Validate one protected E2E run end-to-end; optionally add a second reviewer for resilience. | 2026-03-04 |

## Verification log

| Date | Scope | Result | Notes |
| --- | --- | --- | --- |
| 2026-02-27 | `forge test --match-path 'test/Aegis*.t.sol'` | PASS | 212/212 tests passed. |
| 2026-02-27 | `forge test --match-path 'test/invariants/*.t.sol'` | PASS | 5/5 invariants passed (256 runs each). |
| 2026-02-27 | `cd mcp && AEGIS_PRIVATE_KEY=... npm exec -y vitest -- run tests/e2e/mcp-e2e.test.ts` | PASS | 10/10 passed after reliability hardening. |
| 2026-02-27 | Same MCP E2E command (repeat runs) | PASS | Consecutive successful runs after nested-cause retry detection. |
| 2026-02-27 | Same MCP E2E command (post runtime failover rollout) | PASS | 10/10 passed; transient `getAgentJobs` transport error recovered via retry path. |
| 2026-03-02 | `cd mcp && npm exec -y vitest -- run tests/config.test.ts tests/tools/*.test.ts` | PASS | Config resolver + MCP unit coverage includes RPC URL ordering and dedupe behavior. |
| 2026-03-02 | `cd mcp && AEGIS_PRIVATE_KEY=... npm exec -y vitest -- run tests/e2e/mcp-e2e.test.ts` | PASS | 10/10 passed after CI wiring and runbook rollout. |
| 2026-03-02 | GitHub Actions environment + secret validation (`gh` checks) | PASS | `testnet-e2e` protected environment active with required reviewer + `main` branch policy; required secrets present. |
| 2026-03-04 | `forge fmt --check` | PASS | Formatting issues resolved locally; CI `forge fmt` blocker on latest `main` code is cleared in current branch. |
| 2026-03-04 | `forge test --match-path 'test/Aegis*.t.sol'` | PASS | 212/212 tests passed after formatting updates. |
| 2026-03-04 | `forge test --match-path 'test/invariants/*.t.sol'` | PASS | 5/5 invariants passed (256 runs each) after formatting updates. |
| 2026-03-04 | `cd mcp && npm exec -y vitest -- run tests/config.test.ts tests/tools/*.test.ts` | PASS | 15/15 MCP config/unit tests passed. |
| 2026-03-04 | GitHub environment + secrets inventory (`gh api` + `gh secret list`) | PASS | `testnet-e2e` exists with custom branch policy (`main`) and required secrets names present. |
| 2026-03-04 | GitHub environment reviewer-policy update (`gh api --method PUT .../environments/testnet-e2e`) | PASS | Set `prevent_self_review=false` with required reviewer retained to avoid approval deadlocks. |

## Update process (for all agents)

1. Assign ID `OPS-###` and add a risk row with severity and impact.
2. Update `Status`, `Mitigation in place`, `Next action`, and `Last reviewed`.
3. Refresh `Snapshot` counts.
4. Add verification evidence when mitigations are validated.
5. If risk is security-related, also update `docs/security/SECURITY-TRACKER.md`.

## Changelog

- 2026-02-27: Initialized tracker with OPS-001 (external RPC transport instability) and OPS-002 (live E2E funding drift).
- 2026-03-04: Refreshed verification evidence, added OPS-003 (protected environment reviewer deadlock risk), and updated OPS-001 next actions.
- 2026-03-04: Updated `testnet-e2e` reviewer policy (`prevent_self_review=false`) and moved OPS-003 to MONITORING.
