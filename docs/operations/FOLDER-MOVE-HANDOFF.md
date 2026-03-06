# Aegis Protocol Folder Move Handoff

Last updated: 2026-03-06

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
- CrewAI integration slice is complete:
  - example: `sdk/examples/crewai-agent.py`
  - examples script: `sdk/examples/package.json` (`crewai-agent`)
  - checkpoint: `docs/operations/WIP-CHECKPOINT-2026-03-04-CREWAI.md`
- ElizaOS integration slice is complete:
  - package: `sdk/packages/elizaos` (`@aegis-protocol/elizaos`)
  - example: `sdk/examples/eliza-character.ts`
  - checkpoint: `docs/operations/WIP-CHECKPOINT-2026-03-06-ELIZAOS.md`
- Virtuals integration slice is complete:
  - package: `sdk/packages/virtuals` (`@aegis-protocol/virtuals`)
  - example: `sdk/examples/virtuals-agent.ts`
  - checkpoint: `docs/operations/WIP-CHECKPOINT-2026-03-06-VIRTUALS.md`
- Agent-first distribution reset is documented:
  - execution playbook: `content/agent-promotion-playbook.md`
  - canonical rationale memo: `docs/decisions/2026-03-06-agent-first-distribution.md`
  - current north star: external agent usage
- MCP optimization and instrumentation slice is complete:
  - advisory tool funnel improved (`aegis_should_i_escrow` now returns next-tool guidance)
  - signer-mode `aegis_check_balance` can inspect the connected wallet without an explicit address
  - optional JSONL usage logging available via `AEGIS_USAGE_LOG_PATH` + `AEGIS_USAGE_CONTEXT`
  - checkpoint: `docs/operations/WIP-CHECKPOINT-2026-03-06-MCP-OPTIMIZATION.md`
- CrewAI/LangChain distribution polish is complete:
  - LangChain package now exposes `aegis_should_i_escrow` and `aegis_settle_job`
  - LangChain example prompt starts from the advisory decision point instead of jumping straight to balance checks
  - CrewAI example passes default usage-source attribution into the MCP server when logging is enabled
  - checkpoint: `docs/operations/WIP-CHECKPOINT-2026-03-06-CREWAI-LANGCHAIN-POLISH.md`

Pending / watch items:
- Immediate framework expansion work is `AutoGPT` only if evidence changes.
- Immediate non-framework work is operator/default-placement adoption for the shipped MCP, ElizaOS, Virtuals, CrewAI, and LangChain surfaces.
- `AutoGPT` is explicitly deferred unless evidence changes.
- OPS-002 mitigation is shipped: MCP E2E now enforces minimum USDC/allowance preflight guardrails before repeated live runs.
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
3) Continue agent-first distribution execution from `content/agent-promotion-playbook.md` and `docs/decisions/2026-03-06-agent-first-distribution.md`.
4) Start the next engineering slice in this order: operator/default-placement adoption work for the shipped integrations, then AutoGPT only if evidence changes.
5) Update docs/operations/ENGINEERING-RISK-TRACKER.md and docs/operations/RELIABILITY-RUNBOOK.md when new evidence or risks appear.
6) Flag a "state of the project" milestone when one major implementation slice is completed and validated.
```
