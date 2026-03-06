# WIP Checkpoint — 2026-03-06 — Virtuals Integration

## Scope Completed

Shipped the first AEGIS `Virtuals` integration slice as a repo-native SDK package instead of leaving the effort at discovery level.

Delivered artifacts:
- `sdk/packages/virtuals`
  - `@aegis-protocol/virtuals`
  - GAME worker/functions for AEGIS advisory, read, and optional write paths
  - ACP helper exports for custom requirement/deliverable schemas and profile resources
- `sdk/examples/virtuals-agent.ts`
  - runnable config summary for a Virtuals GAME/ACP operator
- repo/docs sync
  - `README.md`
  - `docs/README.md`
  - `TASKS.md`
  - `CLAUDE.md`
  - `docs/operations/FOLDER-MOVE-HANDOFF.md`

## Why This Shape

Virtuals' current builder surface is `GAME SDK + ACP`. The practical integration seam is not a dedicated AEGIS hook inside Virtuals, but:
- GAME workers/functions for agent decision/runtime behavior
- ACP custom job schemas/resources for operator-defined service surfaces

That means the correct first slice is:
- expose AEGIS inside GAME as a worker/function set
- export ACP-facing schemas/resources that make AEGIS visible in agent profiles and structured job flows
- avoid pretending we can fully automate ACP wallet whitelisting or registry setup locally

## What Shipped

### GAME worker

`createAegisVirtualsWorker(options)` ships these functions:
- `aegis_should_i_escrow`
- `aegis_lookup_agent`
- `aegis_check_balance`
- `aegis_check_job`
- `aegis_approve_escrow`
- `aegis_create_job`
- `aegis_submit_deliverable`
- `aegis_settle_job`

Write functions are optional and require a signer-backed `AegisClient`.

### ACP helpers

`createAegisAcpSchemas()` exports:
- requirement schema aligned to AEGIS job creation inputs
- deliverable schema aligned to AEGIS deliverable submission inputs

`createAegisAcpResources()` exports operator-facing ACP resource entries for:
- repo/docs
- decision guide
- MCP entry point

### Prompt block

`createAegisVirtualsPrompt()` provides the guidance block that tells GAME/ACP agents when to route work into escrow:
- high-value threshold guidance
- high-risk vs low-risk job categories
- preferred function sequence
- explicit note that agent-first does not remove operator responsibilities for ACP setup

## Validation Run

Executed successfully:
- `npx -y pnpm@9.15.4 -C sdk install`
- `npx -y pnpm@9.15.4 -C sdk --filter @aegis-protocol/virtuals lint`
- `npx -y pnpm@9.15.4 -C sdk --filter @aegis-protocol/virtuals build`
- `npx -y pnpm@9.15.4 -C sdk --filter @aegis-protocol/virtuals test`
- `npx -y pnpm@9.15.4 -C sdk --filter @aegis-protocol/examples virtuals-agent`

Not executed in this slice:
- live ACP registry onboarding
- GAME agent init/run against a live Virtuals API key
- ACP wallet whitelisting or sandbox/mainnet job flow

## Remaining Gaps

This slice does **not** yet prove live external adoption. Remaining work for Virtuals should focus on:
- operator onboarding docs tuned for ACP profile setup
- distribution/polish for CrewAI/LangChain and similar frameworks already shipped
- direct conversations with Virtuals operators/maintainers about default placement or profile-template adoption

## Recommended Next Step

Move to `CrewAI/LangChain` distribution polish now that the three strategic adapter surfaces are in place:
- MCP
- ElizaOS
- Virtuals

`AutoGPT` remains deferred unless evidence changes.
