# Aegis WIP Checkpoint — MCP Optimization & Instrumentation

Date: 2026-03-06  
Branch: `codex/crewai-integration`  
Baseline commit: `b6e4dec` (`OPS-002` guardrail checkpoint)

## Purpose

This checkpoint marks completion of the first agent-first MCP optimization slice:
improving decision-oriented tool metadata, making the advisory path more actionable,
and adding optional usage instrumentation that can distinguish external activity
from demos and tests.

## Scope Completed

- Improved MCP tool descriptions around decision triggers instead of generic capability statements:
  - `aegis_should_i_escrow`
  - `aegis_create_job`
  - `aegis_lookup_agent`
  - `aegis_check_balance`
- Improved advisory funnel:
  - `aegis_should_i_escrow` now returns `recommendedTools`
  - output points callers toward `aegis_lookup_agent`, `aegis_check_balance`, and `aegis_create_job` when appropriate
- Improved signer-mode UX:
  - `aegis_check_balance` can inspect the connected wallet when `address` is omitted
- Added optional MCP JSONL usage logging:
  - `AEGIS_USAGE_LOG_PATH`
  - `AEGIS_USAGE_CONTEXT`
  - `AEGIS_USAGE_ACTOR`
  - `AEGIS_USAGE_SOURCE`
- Centralized per-tool logging in the MCP server wrapper:
  - records tool name, category, success/failure, latency, chain, mode, and attribution metadata
  - does not log full tool arguments
- Updated MCP/operator docs and project tracking:
  - `mcp/README.md`
  - `TASKS.md`
  - `docs/operations/FOLDER-MOVE-HANDOFF.md`

## Verification Evidence

- `cd mcp && npm run typecheck` -> PASS
- `cd mcp && npm exec -y vitest -- run tests/config.test.ts tests/helpers/usage-log.test.ts tests/tools/check-balance.test.ts tests/tools/should-i-escrow.test.ts tests/tools/create-job.test.ts` -> PASS (18/18)

## Next Slice

1. Start `ElizaOS` integration.
2. Follow with `Virtuals` discovery / integration.
3. Revisit CrewAI/LangChain distribution polish after those framework-facing surfaces are in place.
