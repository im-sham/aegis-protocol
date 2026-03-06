# Aegis WIP Checkpoint — LangChain Integration

Date: 2026-03-04  
Branch: `codex/langchain-integration`  
Baseline commit: `bcaa5f7` (`main` after reliability checkpoint merge)

Follow-up note (2026-03-06): the `OPS-002` wallet balance/allowance guardrail work referenced below has since shipped and is now tracked as `MONITORING` in `docs/operations/ENGINEERING-RISK-TRACKER.md`.

## Purpose

This checkpoint marks completion of the first AI-framework integration slice after reliability hardening: LangChain/LangGraph support for AEGIS via a dedicated SDK package and runnable example.

## Scope Completed

- Added new package: `sdk/packages/langchain` (`@aegis-protocol/langchain`)
  - `createAegisLangChainTools(...)` factory.
  - Read tools: `aegis_check_balance`, `aegis_lookup_agent`, `aegis_check_job`.
  - Optional write tools: `aegis_approve_escrow`, `aegis_create_job`, `aegis_submit_deliverable`.
- Added unit tests for the package:
  - `sdk/packages/langchain/src/__tests__/tools.test.ts` (6 tests).
- Added runnable example:
  - `sdk/examples/langchain-agent.ts` (LangGraph ReAct agent using AEGIS tools).
- Updated project tracking/docs:
  - `TASKS.md`
  - `docs/README.md`
  - `README.md`
  - `docs/operations/FOLDER-MOVE-HANDOFF.md`

## Verification Evidence

- `npx -y pnpm@9.15.4 -C sdk --filter @aegis-protocol/langchain lint` -> PASS
- `npx -y pnpm@9.15.4 -C sdk --filter @aegis-protocol/langchain build` -> PASS
- `npx -y pnpm@9.15.4 -C sdk --filter @aegis-protocol/langchain test` -> PASS (6/6)
- `npx -y pnpm@9.15.4 -C sdk --filter @aegis-protocol/examples langchain-agent -- "smoke"` -> expected fast-fail without `OPENAI_API_KEY`
- CI run `22682467781` on `codex/langchain-integration` -> PASS (Foundry/API/MCP/Subgraph; MCP E2E skipped on PR branch)

## Notable Follow-up During Slice

- Root workspace lockfile drift caused initial CI install failures.
- Fixed via root lockfile sync commit on branch:
  - `71810da` (`pnpm-lock.yaml` update)

## Merge Completion Evidence

- PR `#7` merged to `main`.
- Merge commit: `6973f51`.
- `main` CI run `22686298159` -> PASS (Foundry/API/MCP/Subgraph + protected `MCP E2E`).

## Next Slice (Historical at Checkpoint Time)

Current sequencing lives in `docs/operations/FOLDER-MOVE-HANDOFF.md`, `TASKS.md`, and `docs/decisions/2026-03-06-agent-first-distribution.md`.

1. Start `CrewAI` integration using LangChain package patterns.
2. Address OPS-002 by adding explicit E2E wallet balance/allowance guardrails.
