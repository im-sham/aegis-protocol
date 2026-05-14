# Aegis Protocol Engineering Risk Tracker

Last updated: 2026-05-14

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
- Open P2+: 0
- Monitoring: 3
- Mitigated: 0
- Accepted risk: 0

## Risk register

| ID | Severity | Area | Summary | Detected | Status | Owner | Mitigation in place | Monitoring signal | Next action | Last reviewed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| OPS-001 | P1 | MCP / External RPC | Public Base Sepolia RPC endpoints intermittently timeout (`ETIMEDOUT`, `EHOSTUNREACH`) causing false-negative MCP E2E failures and occasional write failures. | 2026-02-27 | MONITORING | Unassigned | E2E retries + nested error-cause transient detection are in place, runtime failover is implemented via prioritized RPC lists (`AEGIS_RPC_URLS`) in MCP/SDK transport setup, CI workflow is wired for primary/secondary RPC secrets with trusted-event + protected-environment gating, and reliability runbook is documented. Dedicated Alchemy primary/secondary endpoints are active in GitHub secrets, endpoint health checks passed, and protected `main` MCP E2E completed successfully. Evidence: `mcp/tests/e2e/mcp-e2e.test.ts`, `mcp/src/sdk-client.ts`, `sdk/packages/sdk/src/client.ts`, `.github/workflows/test.yml`, `docs/operations/RELIABILITY-RUNBOOK.md`, `gh secret list` output, endpoint `eth_blockNumber` responses, runs `22681335573` and `25634682776`. | Any transport-related retry/failure in MCP E2E runs. | Keep weekly protected E2E verification cadence and rotate RPC secrets on schedule or provider incident. | 2026-05-10 |
| OPS-002 | P2 | Test Infra / Funding | Repeated live E2E runs consume gas and escrowed USDC on the signer wallet, which can eventually block tests or produce misleading failures. | 2026-02-27 | MONITORING | Unassigned | MCP E2E now enforces minimum signer preflight thresholds for USDC balance and escrow allowance (default `>= 10 USDC`) before any live lifecycle test runs, and the runbook documents the remediation path. Evidence: `mcp/tests/e2e/mcp-e2e.test.ts`, `docs/operations/RELIABILITY-RUNBOOK.md`. | Guardrail preflight failure or repeated wallet top-up/approval events. | Keep thresholds calibrated to the live test flow and top up/re-approve the E2E wallet whenever preflight fails. | 2026-03-06 |
| OPS-003 | P1 | CI Governance | Protected environment approval flow can deadlock or leave public `main` runs waiting if live E2E runs are triggered automatically. | 2026-03-04 | MONITORING | Unassigned | `testnet-e2e` retains required reviewer + `main` branch policy, `prevent_self_review=false` avoids the solo-maintainer deadlock, and `mcp-e2e` is now manual-only via `workflow_dispatch` so routine `push` and PR CI do not wait on protected environment approval. | Manual `mcp-e2e` approval stalls, unexpected bypass behavior, or routine CI waiting on `testnet-e2e`. | Add a secondary reviewer to improve approval-path resilience for maintainer unavailability. | 2026-05-14 |

## Verification log

| Date | Scope | Result | Notes |
| --- | --- | --- | --- |
| 2026-02-27 | `forge test --match-path 'test/Aegis*.t.sol'` | PASS | 212/212 tests passed. |
| 2026-02-27 | `forge test --match-path 'test/invariants/*.t.sol'` | PASS | 5/5 invariants passed (256 runs each). |
| 2026-02-27 | `cd mcp && AEGIS_PRIVATE_KEY=... npm exec -y vitest -- run tests/e2e/mcp-e2e.test.ts` | PASS | 10/10 passed after reliability hardening. |
| 2026-02-27 | Same MCP E2E command (repeat runs) | PASS | Consecutive successful runs after nested-cause retry detection. |
| 2026-02-27 | Same MCP E2E command (post runtime failover rollout) | PASS | 10/10 passed; transient `getAgentJobs` transport error recovered via retry path. |
| 2026-03-02 | `cd mcp && pnpm test` | PASS | Config resolver + MCP unit coverage includes RPC URL ordering and dedupe behavior. |
| 2026-03-02 | `cd mcp && AEGIS_PRIVATE_KEY=... npm exec -y vitest -- run tests/e2e/mcp-e2e.test.ts` | PASS | 10/10 passed after CI wiring and runbook rollout. |
| 2026-03-02 | GitHub Actions environment + secret validation (`gh` checks) | PASS | `testnet-e2e` protected environment active with required reviewer + `main` branch policy; required secrets present. |
| 2026-03-04 | `forge fmt --check` | PASS | Formatting issues resolved locally; CI `forge fmt` blocker on latest `main` code is cleared in current branch. |
| 2026-03-04 | `forge test --match-path 'test/Aegis*.t.sol'` | PASS | 212/212 tests passed after formatting updates. |
| 2026-03-04 | `forge test --match-path 'test/invariants/*.t.sol'` | PASS | 5/5 invariants passed (256 runs each) after formatting updates. |
| 2026-03-04 | `cd mcp && npm exec -y vitest -- run tests/config.test.ts tests/tools/*.test.ts` | PASS | 15/15 MCP config/unit tests passed. |
| 2026-03-04 | GitHub environment + secrets inventory (`gh api` + `gh secret list`) | PASS | `testnet-e2e` exists with custom branch policy (`main`) and required secrets names present. |
| 2026-03-04 | GitHub environment reviewer-policy update (`gh api --method PUT .../environments/testnet-e2e`) | PASS | Set `prevent_self_review=false` with required reviewer retained to avoid approval deadlocks. |
| 2026-03-04 | GitHub RPC secret rotation (`gh secret set BASE_SEPOLIA_RPC_URL_PRIMARY/SECONDARY`) | PASS | Both Base Sepolia RPC secret values updated to dedicated Alchemy endpoints. |
| 2026-03-04 | Endpoint health checks (`curl` + `eth_blockNumber`) | PASS | Primary and secondary dedicated endpoints both returned current block numbers. |
| 2026-03-04 | `gh workflow run test.yml --ref codex/aegis-reliability-checkpoint-20260304` | PARTIAL | `mcp-e2e` was rejected by environment branch policy (`main`-only), confirming secrets are configured but protected E2E must run from `main`. |
| 2026-03-04 | `main` CI run `22681335573` (merge of PR #6) with protected `testnet-e2e` approval | PASS | Full CI succeeded; `MCP E2E (Base Sepolia)` executed on `main` and passed (10/10). |
| 2026-03-06 | `cd mcp && npm run typecheck` | PASS | MCP test suite type-check passes after adding enforced E2E balance/allowance preflight guardrails. |
| 2026-05-10 | GitHub Actions CI run `25634682776` on `main` | PASS | Full CI passed after approving protected `testnet-e2e`; Foundry, MCP unit/typecheck, API, Subgraph, and live Base Sepolia MCP E2E all succeeded. |
| 2026-05-14 | CI workflow governance cleanup | PENDING | `mcp-e2e` changed to manual-only so regular `push` and PR runs do not accumulate protected-environment waits; verify after merge by confirming routine CI completes without `testnet-e2e` waiting. |

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
- 2026-03-06: Enforced MCP E2E wallet balance/allowance preflight guardrails and moved OPS-002 to MONITORING.
- 2026-05-10: Approved and verified protected `main` CI run `25634682776`; full CI including live Base Sepolia MCP E2E passed. Refreshed OPS-001/OPS-003 evidence.
- 2026-05-14: Updated CI governance to keep live Base Sepolia MCP E2E manual-only and avoid routine public CI runs waiting on protected environment approval.
