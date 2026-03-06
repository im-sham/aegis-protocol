# Outreach Send-Ready Messages — 2026-03-06

## Purpose

These are final send-ready versions of the first outreach batch.

Rules:
- keep the ask narrow
- do not add multiple framework pitches to one message
- link only the assets relevant to that ecosystem
- after sending, record the touch in `docs/operations/OUTREACH-TRACKER.md` using `docs/operations/OUTREACH-LOG-TEMPLATE.md`

## Shared Public Links

- Repo: `https://github.com/im-sham/aegis-protocol`
- Operator kit: `https://github.com/im-sham/aegis-protocol/blob/codex/crewai-integration/docs/integrations/OPERATOR-ADOPTION-KIT.md`
- Virtuals adapter: `https://github.com/im-sham/aegis-protocol/tree/codex/crewai-integration/sdk/packages/virtuals`
- Virtuals example: `https://github.com/im-sham/aegis-protocol/blob/codex/crewai-integration/sdk/examples/virtuals-agent.ts`
- ElizaOS adapter: `https://github.com/im-sham/aegis-protocol/tree/codex/crewai-integration/sdk/packages/elizaos`
- ElizaOS example: `https://github.com/im-sham/aegis-protocol/blob/codex/crewai-integration/sdk/examples/eliza-character.ts`
- CrewAI example: `https://github.com/im-sham/aegis-protocol/blob/codex/crewai-integration/sdk/examples/crewai-agent.py`
- LangChain adapter: `https://github.com/im-sham/aegis-protocol/tree/codex/crewai-integration/sdk/packages/langchain`
- LangChain example: `https://github.com/im-sham/aegis-protocol/blob/codex/crewai-integration/sdk/examples/langchain-agent.ts`

## Virtuals / ACP

### Discord / DM version

Built an AEGIS adapter for Virtuals GAME / ACP and I want to validate the right insertion point before pushing harder on distribution.

AEGIS is the trust layer for external-agent work when direct payment is too risky: decide whether the task should be escrowed, verify the counterparty, then settle only after the deliverable clears validation. We now ship a Virtuals-facing adapter with ACP schema/resource helpers and a GAME worker surface.

Narrow ask: from an operator perspective, is the strongest motion profile templates, workflow guidance, or an explicit recommended path for high-value services?

Links:
- repo: https://github.com/im-sham/aegis-protocol
- adapter: https://github.com/im-sham/aegis-protocol/tree/codex/crewai-integration/sdk/packages/virtuals
- example: https://github.com/im-sham/aegis-protocol/blob/codex/crewai-integration/sdk/examples/virtuals-agent.ts
- operator kit: https://github.com/im-sham/aegis-protocol/blob/codex/crewai-integration/docs/integrations/OPERATOR-ADOPTION-KIT.md

### GitHub issue / discussion version

Title: Validate the right insertion point for AEGIS in higher-risk ACP workflows

I built an AEGIS adapter around the current GAME / ACP surface and want to validate the best placement before pushing for broader adoption.

AEGIS is a narrow trust layer for external-agent work when direct payment is too risky because the task is valuable, the provider is new, or the deliverable needs validation before release of funds. The current adapter exposes:
- a GAME worker/function path
- ACP schema/resource helpers
- an operator-facing decision flow starting with `aegis_should_i_escrow`

The narrow ask is not “should ACP use escrow everywhere.” It is:
- for higher-risk services, is the strongest operator motion profile templates, workflow guidance, or a more explicit recommended path?

Relevant links:
- repo: https://github.com/im-sham/aegis-protocol
- adapter: https://github.com/im-sham/aegis-protocol/tree/codex/crewai-integration/sdk/packages/virtuals
- example: https://github.com/im-sham/aegis-protocol/blob/codex/crewai-integration/sdk/examples/virtuals-agent.ts
- operator kit: https://github.com/im-sham/aegis-protocol/blob/codex/crewai-integration/docs/integrations/OPERATOR-ADOPTION-KIT.md

## ElizaOS

### Maintainer / operator message

Built an ElizaOS plugin for AEGIS and want to validate whether it belongs in a recommended bundle for agents that outsource meaningful work.

AEGIS is the trust layer for agent-to-agent work when value, counterparty trust, or deliverable validation make direct payment unsafe. The current plugin already ships advisory, read, and write actions, but I am trying to validate the smallest useful default-placement motion.

Narrow ask: should a simple “external specialist” plugin bundle include an escrow decision/action path by default, or is that better left to optional workflow guidance?

Links:
- repo: https://github.com/im-sham/aegis-protocol
- plugin: https://github.com/im-sham/aegis-protocol/tree/codex/crewai-integration/sdk/packages/elizaos
- example: https://github.com/im-sham/aegis-protocol/blob/codex/crewai-integration/sdk/examples/eliza-character.ts
- operator kit: https://github.com/im-sham/aegis-protocol/blob/codex/crewai-integration/docs/integrations/OPERATOR-ADOPTION-KIT.md

## CrewAI

### Forum / maintainer message

Built a CrewAI MCP-backed AEGIS example and want to validate whether the real value is a coordinator-agent pattern for external specialists.

AEGIS adds escrow, validation, and dispute handling when a crew hires an external specialist and direct payment is too risky. I am not pitching a broad “payments integration.” The narrower motion is a coordinator flow that starts with an escrow advisory step before approving payment or creating the specialist job.

Narrow ask: would that be valuable enough to justify a public reference pattern or example contribution?

Links:
- repo: https://github.com/im-sham/aegis-protocol
- example: https://github.com/im-sham/aegis-protocol/blob/codex/crewai-integration/sdk/examples/crewai-agent.py
- operator kit: https://github.com/im-sham/aegis-protocol/blob/codex/crewai-integration/docs/integrations/OPERATOR-ADOPTION-KIT.md

## LangChain

### Forum / maintainer message

Built a LangChain adapter for AEGIS and want to validate a very specific pattern rather than make a broad framework claim.

AEGIS is an escrow and validation layer for agent-to-agent work when direct payment is too risky. The adapter already exposes an advisory-first path starting with `aegis_should_i_escrow`, followed by counterparty and balance checks before any write path.

Narrow ask: would LangChain users benefit from a small reference pattern for high-value outsourced work where the agent begins with the advisory call before paying an unknown external specialist?

Links:
- repo: https://github.com/im-sham/aegis-protocol
- adapter: https://github.com/im-sham/aegis-protocol/tree/codex/crewai-integration/sdk/packages/langchain
- example: https://github.com/im-sham/aegis-protocol/blob/codex/crewai-integration/sdk/examples/langchain-agent.ts
- operator kit: https://github.com/im-sham/aegis-protocol/blob/codex/crewai-integration/docs/integrations/OPERATOR-ADOPTION-KIT.md
