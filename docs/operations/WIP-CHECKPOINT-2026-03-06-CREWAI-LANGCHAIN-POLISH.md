# WIP Checkpoint — 2026-03-06 — CrewAI/LangChain Distribution Polish

## Scope Completed

Polished the already-shipped `CrewAI` and `LangChain` integration surfaces so the agent-first decision funnel is more consistent across the repo.

Delivered artifacts:
- `sdk/packages/langchain`
  - advisory tool parity via `aegis_should_i_escrow`
  - settlement parity via `aegis_settle_job`
- `sdk/examples/langchain-agent.ts`
  - default prompt now begins from the advisory decision step
- `sdk/examples/crewai-agent.py`
  - passes default MCP usage attribution (`AEGIS_USAGE_SOURCE=crewai-example`) when logging is enabled
- repo/docs sync
  - `README.md`
  - `TASKS.md`
  - `CLAUDE.md`
  - `docs/operations/FOLDER-MOVE-HANDOFF.md`

## Why This Slice

After MCP, ElizaOS, and Virtuals were aligned around `aegis_should_i_escrow`, the native LangChain surface was still lagging behind. That weakened the actual agent-first funnel because one of the shipped integrations still started too deep in the workflow.

CrewAI also needed a small but important polish step: usage attribution defaults so demo/example traffic can be separated from real operator traffic whenever MCP usage logging is enabled.

## What Changed

### LangChain

`createAegisLangChainTools()` now includes:
- `aegis_should_i_escrow`
- `aegis_settle_job`

This brings the LangChain adapter into closer parity with:
- MCP
- ElizaOS
- Virtuals

The example prompt in `sdk/examples/langchain-agent.ts` now starts by asking the agent to call `aegis_should_i_escrow` for a high-value, validation-sensitive job before checking balances or counterparties.

### CrewAI

`build_mcp_env()` in `sdk/examples/crewai-agent.py` now:
- defaults `AEGIS_USAGE_SOURCE=crewai-example`
- passes through optional usage logging envs:
  - `AEGIS_USAGE_LOG_PATH`
  - `AEGIS_USAGE_CONTEXT`
  - `AEGIS_USAGE_ACTOR`

This keeps attribution clean whenever MCP logging is turned on without forcing logging for every run.

## Validation Run

Executed successfully:
- `npx -y pnpm@9.15.4 -C sdk --filter @aegis-protocol/langchain lint`
- `npx -y pnpm@9.15.4 -C sdk --filter @aegis-protocol/langchain build`
- `npx -y pnpm@9.15.4 -C sdk --filter @aegis-protocol/langchain test`
- `python3 -m py_compile sdk/examples/crewai-agent.py`
- `cd sdk/examples && env -u OPENAI_API_KEY npx -y tsx langchain-agent.ts "smoke"` (expected fast-fail)
- `cd sdk/examples && env -u OPENAI_API_KEY python3 crewai-agent.py "smoke"` (expected fast-fail)

Expected behavior observed:
- LangChain example/tool package includes advisory path and settlement path.
- LangChain example still fast-fails without `OPENAI_API_KEY`.
- CrewAI example still fast-fails without `OPENAI_API_KEY`.
- CrewAI example remains dependency-safe and does not require live MCP logging unless the operator sets it.

## Remaining Gaps

This slice improves distribution readiness but does not itself create external traffic.

What remains outside pure code:
- operator/default-placement outreach for shipped integrations
- live adoption feedback from Virtuals/Eliza/CrewAI/LangChain users
- `AutoGPT` only if evidence changes and it becomes strategically worthwhile

## Recommended Next Step

Do not rush into another framework by default.

Prefer next work in this order:
1. operator/default-placement adoption for the shipped integrations
2. more instrumentation only if adoption feedback shows a blind spot
3. `AutoGPT` only if evidence changes
