# Outreach Batch — 2026-03-06 — Agent Frameworks

## Purpose

This is the first concrete outreach batch for agent-native adoption after shipping:
- MCP
- CrewAI
- LangChain
- ElizaOS
- Virtuals

It converts the operator kit into prioritized execution.

Use this with:
- `docs/integrations/OPERATOR-ADOPTION-KIT.md`
- `content/framework-outreach-snippets.md`
- `docs/operations/OUTREACH-TRACKER.md`

## Batch Goal

Validate whether AEGIS can earn default or recommended placement in the external-agent work path for the ecosystems most aligned with trust-sensitive agent commerce.

The ask is intentionally narrow:
- not a broad partnership pitch
- not a request to endorse the whole protocol
- not a request to add escrow to trivial flows

The ask is:
- review a minimal advisory-first pattern for high-value or validation-sensitive external-agent work

## Priority Order

1. Virtuals / ACP operators
2. ElizaOS maintainers and operators
3. CrewAI workflow owners
4. LangChain workflow owners or maintainers

## Batch 1 — Virtuals / ACP

### Why first

Virtuals is the closest live surface to agent-commerce workflows. The most important question is not whether AEGIS can integrate technically, but where operators actually want the trust layer to appear:
- ACP profile/resource templates
- GAME prompt blocks
- workflow guidance for higher-risk services
- explicit recommendation for jobs above a threshold

### Assets to send

- `sdk/packages/virtuals`
- `sdk/examples/virtuals-agent.ts`
- `docs/integrations/OPERATOR-ADOPTION-KIT.md`
- `content/framework-outreach-snippets.md` (Virtuals / ACP section)

### Recommended first channels

- Virtuals Discord `#builders-chat`
- ACP onboarding/build docs
- GitHub: `Virtual-Protocol/acp-node` or `game-by-virtuals/game-node`

### Primary ask

Which insertion point is strongest for real operator adoption:
- profile template
- workflow guidance
- recommended path for high-value services
- plugin/default placement

### Ready-to-send message

Subject: AEGIS as a trust layer for higher-risk ACP work

ACP already handles agent discovery and job flow well. The gap I am targeting is the point where the work becomes valuable enough, or subjective enough, that direct payment starts to feel unsafe.

AEGIS fits there as an optional trust layer: decide whether the task should be escrowed, verify the counterparty, then settle only after the deliverable clears validation. We now ship a Virtuals-facing adapter with ACP schema/resource helpers and a GAME worker surface.

Concrete ask: I want feedback on the right insertion point from an operator perspective. Is the strongest motion profile templates, workflow guidance, or an explicit recommended path for high-value services?

### Links to include

- GitHub repo: `https://github.com/im-sham/aegis-protocol`
- Virtuals adapter path: `sdk/packages/virtuals`
- operator kit: `docs/integrations/OPERATOR-ADOPTION-KIT.md`

## Batch 2 — ElizaOS

### Why second

ElizaOS is already the strongest Web3-native framework surface we have shipped against. The next question is whether the AEGIS plugin should be part of a default or recommended bundle for agents that outsource meaningful work.

### Assets to send

- `sdk/packages/elizaos`
- `sdk/examples/eliza-character.ts`
- `docs/integrations/OPERATOR-ADOPTION-KIT.md`
- `content/framework-outreach-snippets.md` (ElizaOS section)

### Recommended first channels

- GitHub: `elizaOS/eliza`
- official docs/community path from `eliza.how/quickstart`

### Primary ask

Should a default or recommended “external specialist” plugin bundle include an escrow decision/action path?

### Ready-to-send message

Subject: AEGIS plugin for high-value external-agent work

AEGIS is a trust layer for agent-to-agent work when value, counterparty trust, or deliverable validation make direct payment unsafe. We have already shipped an ElizaOS plugin package and the next step is determining whether it fits a default or recommended path for agents that outsource meaningful work.

Concrete ask: would you review whether a simple “external specialist” plugin bundle should include an escrow decision/action path by default? I am specifically trying to avoid forcing escrow into trivial flows.

### Links to include

- GitHub repo: `https://github.com/im-sham/aegis-protocol`
- ElizaOS adapter path: `sdk/packages/elizaos`
- operator kit: `docs/integrations/OPERATOR-ADOPTION-KIT.md`

## Batch 3 — CrewAI

### Why third

CrewAI is a strong coordinator surface for hiring external specialist agents. The most important question is whether AEGIS belongs in recommended coordinator-agent patterns, not whether a general integration exists.

### Assets to send

- `sdk/examples/crewai-agent.py`
- `docs/integrations/OPERATOR-ADOPTION-KIT.md`
- `content/framework-outreach-snippets.md` (CrewAI section)

### Recommended first channels

- CrewAI Forum
- GitHub: `crewAIInc/crewAI`

### Primary ask

Would a coordinator-agent pattern that starts with an escrow advisory step be valuable enough to justify a public example or reference integration?

### Ready-to-send message

Subject: AEGIS for crew-to-specialist payment safety

AEGIS adds escrow, validation, and dispute handling when a crew hires an external specialist and direct payment is too risky. We already have a CrewAI MCP-backed example; the next thing I want to validate is whether this belongs in recommended coordinator-agent patterns for high-value external work.

Concrete ask: would you review a minimal crew pattern where the coordinator calls an escrow decision tool before approving payment or creating a specialist job? I am optimizing for narrow, high-signal use cases rather than broad platform claims.

### Links to include

- GitHub repo: `https://github.com/im-sham/aegis-protocol`
- CrewAI example path: `sdk/examples/crewai-agent.py`
- operator kit: `docs/integrations/OPERATOR-ADOPTION-KIT.md`

## Batch 4 — LangChain

### Why fourth

LangChain is important, but it is less commerce-native than Virtuals or ElizaOS. The right ask is therefore narrow: whether AEGIS should appear in recommended external-agent tool sequences rather than as a broad “payments integration.”

### Assets to send

- `sdk/packages/langchain`
- `sdk/examples/langchain-agent.ts`
- `docs/integrations/OPERATOR-ADOPTION-KIT.md`
- `content/framework-outreach-snippets.md` (LangChain section)

### Recommended first channels

- LangChain Forum
- GitHub: `langchain-ai/langchainjs`

### Primary ask

Would LangChain users benefit from a small reference pattern where high-value external-agent tasks begin with an escrow advisory call before any write path?

### Ready-to-send message

Subject: AEGIS for high-value external-agent flows in LangChain

AEGIS is an escrow and validation layer for agent-to-agent work when direct payment is too risky. We already ship a LangChain adapter, but the specific motion I want to validate is whether LangChain examples or docs should recommend an escrow decision step for outsourced tasks above a threshold.

Concrete ask: would you review a minimal example pattern where the agent calls an advisory tool before paying an unknown external specialist? The goal is not to push more tooling into every flow, only to make the safe path easier to discover when trust and deliverable quality matter.

### Links to include

- GitHub repo: `https://github.com/im-sham/aegis-protocol`
- LangChain adapter path: `sdk/packages/langchain`
- operator kit: `docs/integrations/OPERATOR-ADOPTION-KIT.md`

## Execution Rule

For each conversation:
1. send only one narrow ask
2. include only the integration asset relevant to that ecosystem
3. avoid sending multiple framework pitches in one message
4. capture the result in `docs/operations/OUTREACH-TRACKER.md`
5. if feedback changes the insertion-point thesis, update the operator kit before drafting new outreach
