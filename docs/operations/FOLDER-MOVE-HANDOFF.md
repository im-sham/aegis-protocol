# Aegis Protocol Folder Move Handoff

Last updated: 2026-03-04

## Purpose

This file is the restart point after moving the local repository to a new filesystem path.

## Do You Need a New Thread or Project?

- You do not need a new GitHub repository or a new local project.
- You do not need to push to GitHub just to move folders locally.
- You should open the moved folder as the active workspace path before continuing.
- If the current Codex thread is still bound to the old path, start a new thread from the moved path and use the resume prompt below.

## Pre-Move Checklist

1. Stop running test/watch processes.
2. Capture current local state:
```bash
git status --short
git branch --show-current
```
3. Move the full folder (including `.git`) to the new location.

## Post-Move Validation

Run from the new repository root:

```bash
pwd
git rev-parse --show-toplevel
git status --short
```

Then run targeted checks:

```bash
forge test --match-path 'test/Aegis*.t.sol'
forge test --match-path 'test/invariants/*.t.sol'
cd mcp && npm exec -y vitest -- run tests/config.test.ts tests/tools/*.test.ts
cd mcp && AEGIS_PRIVATE_KEY='REDACTED' npm exec -y vitest -- run tests/e2e/mcp-e2e.test.ts
```

## Current Status Snapshot

Completed:
- Runtime RPC failover is implemented in MCP/SDK using prioritized URL resolution (`AEGIS_RPC_URLS` support).
- Reliability docs exist and are current:
  - `docs/operations/ENGINEERING-RISK-TRACKER.md`
  - `docs/operations/RELIABILITY-RUNBOOK.md`
- GitHub protected environment `testnet-e2e` is configured with required reviewer and branch policy, and self-review deadlock was removed (`prevent_self_review=false`).
- Required GitHub secrets are configured for E2E key + dedicated primary/secondary Base Sepolia RPC endpoints.
- Reliability slice was merged to `main` and validated with protected E2E:
  - PR `#6`
  - `main` CI run `22681335573` completed successfully (including protected `MCP E2E`).
- LangChain integration slice is complete:
  - package: `sdk/packages/langchain` (`@aegis-protocol/langchain`)
  - example: `sdk/examples/langchain-agent.ts`
  - merged in PR `#7` with post-merge `main` CI run `22686298159` passing (including protected `MCP E2E`).

Pending / watch items:
- Next framework integration target is `CrewAI`.
- OPS-002 remains open: add minimum USDC/allowance guardrails before repeated live E2E runs.
- Add secondary reviewer for `testnet-e2e` environment for approval-path resilience.
- Keep weekly engineering risk review cadence in `docs/operations/ENGINEERING-RISK-TRACKER.md`.

## Resume Prompt (Copy/Paste for New Thread)

Use this prompt in a new Codex thread after opening the moved folder:

```text
Workspace path is now: <NEW_ABSOLUTE_PATH_TO_AEGIS_PROTOCOL>.

Continue implementation from docs/operations/FOLDER-MOVE-HANDOFF.md and treat it as the source of truth for project state.

Start with:
1) Validate git/workspace status and confirm no path-related breakage.
2) Run targeted tests listed in the handoff file and report failures with root-cause analysis.
3) Start the next implementation slice: CrewAI integration, using `sdk/packages/langchain` patterns as reference for tool design and docs.
4) Update docs/operations/ENGINEERING-RISK-TRACKER.md and docs/operations/RELIABILITY-RUNBOOK.md when new evidence or risks appear.
5) Flag a "state of the project" milestone when one major implementation slice is completed and validated.
```
