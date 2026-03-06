# WIP Checkpoint — 2026-03-06 — Operator Adoption Kit

## Scope Completed

Shipped the first repo-native operator/default-placement kit for the integration surfaces that are already live.

Delivered artifacts:
- `docs/integrations/OPERATOR-ADOPTION-KIT.md`
  - canonical positioning
  - default decision rule
  - canonical tool order
  - usage attribution standard
  - framework insertion points for MCP, LangChain, CrewAI, ElizaOS, and Virtuals
  - operator checklist
- `content/framework-outreach-snippets.md`
  - short maintainer/operator outreach copy for LangChain, CrewAI, ElizaOS, Virtuals, and general external-specialist workflows
- repo/docs sync
  - `docs/README.md`
  - `content/agent-promotion-playbook.md`
  - `TASKS.md`
  - `CLAUDE.md`
  - `docs/operations/FOLDER-MOVE-HANDOFF.md`

## Why This Slice

The project had a strong strategy doc and shipped integrations, but it still lacked a canonical operational asset that answered:
- what exact copy should a maintainer or operator use?
- where should AEGIS sit in the default workflow?
- how should traffic be labeled so demo activity is not confused with adoption?

That gap increases drift across future sessions and slows down actual operator conversations.

## What The Kit Standardizes

### Positioning

AEGIS is framed narrowly as:
- the trust and settlement layer for external-agent work when direct payment is too risky
- optional for trivial work
- default-recommended for high-value, unknown-counterparty, or validation-sensitive tasks

### Canonical order

The kit standardizes the default sequence:
1. `aegis_should_i_escrow`
2. `aegis_lookup_agent`
3. `aegis_check_balance`
4. `aegis_create_job`
5. `aegis_submit_deliverable`
6. `aegis_settle_job`

### Attribution

The kit defines the recommended usage-labeling fields:
- `AEGIS_USAGE_LOG_PATH`
- `AEGIS_USAGE_SOURCE`
- `AEGIS_USAGE_ACTOR`
- `AEGIS_USAGE_CONTEXT`

### Insertion points

The kit gives framework-specific guidance for:
- MCP
- LangChain
- CrewAI
- ElizaOS
- Virtuals GAME / ACP

## Validation

Validation in this slice was documentation consistency rather than code execution.

Confirmed:
- `docs/README.md` now links the operator kit and outreach snippets
- `content/agent-promotion-playbook.md` points to the new execution assets
- `TASKS.md`, `CLAUDE.md`, and `docs/operations/FOLDER-MOVE-HANDOFF.md` all reflect that the kit exists and that the next step is actual outreach/adoption execution rather than creating more abstract strategy docs

## Remaining Gaps

This slice does not itself create adoption.

What remains:
- real maintainer/operator outreach
- feedback loops from those conversations
- measurable external traffic attributable to placements or recommendations

## Recommended Next Step

Use the shipped kit to execute real conversations and placements:
1. ElizaOS maintainers/operators
2. Virtuals / ACP operators
3. CrewAI / LangChain workflow owners

Only revisit another framework integration if those conversations indicate a better insertion surface than the ones already shipped.
