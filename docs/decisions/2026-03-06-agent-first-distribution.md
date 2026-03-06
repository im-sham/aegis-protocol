# Decision Memo — Agent-First Distribution Reset

**Date:** 2026-03-06  
**Status:** Accepted  
**Canonical use:** This is the primary rationale artifact for future AEGIS strategy reviews and new LLM sessions.

## Decision

AEGIS will prioritize **agent-native distribution aimed at real external agent usage**
over generic awareness or follower-growth tactics.

For the next 30-45 days, the north star is:

- **external agent usage**

This means optimizing for:

- advisory tool usage by external agents or operators
- external write-path usage
- non-demo escrow jobs
- repeat usage from real integrations

## Why the previous playbook was insufficient

The previous playbook correctly identified that agents discover tools differently
from humans, but it overemphasized awareness tactics and speculative channels.

In particular, it was too optimistic about:

- ambassador agents as a primary growth engine
- public memory injection as a broad discovery layer
- social metrics as useful leading indicators
- synthetic on-chain activity as a meaningful proxy for traction

Those tactics may still be useful, but they are experiments. They are not the core
distribution engine.

## What changed

AEGIS is now treating `agent-first` as **distribution through agent choice architecture**.

That means the primary priorities are:

1. MCP optimization and usage instrumentation
2. framework defaults and integrations
3. on-chain discoverability and trust surfaces
4. direct framework-maintainer and operator adoption

Near-term target order:

1. `MCP` optimization
2. `ElizaOS`
3. `Virtuals`
4. `CrewAI / LangChain` distribution polish
5. `AutoGPT` only if evidence changes

## Explicitly deprioritized

The following are not current pillars:

- human-channel-first GTM as the main growth strategy
- social-ambassador-first GTM
- Mem0 or similar memory systems as a primary discovery layer
- vanity metrics such as followers, impressions, or generic conversation volume

These may be run as experiments later, but only with attribution and clean separation
from real usage reporting.

## North star metric

Primary metric for the next 30-45 days:

- **unique external agent or operator usage of AEGIS decision and execution surfaces**

Supporting metrics:

- unique external calls to `aegis_should_i_escrow`
- unique external write-path calls
- non-demo escrow jobs created by external users
- repeat usage from the same environment or integrator
- framework placements that generate attributable traffic

## Review or reversal rule

This decision should be reviewed if any of the following becomes true:

- a supposedly secondary channel produces attributable external usage faster than MCP/integration work
- a specific framework target proves structurally harder or lower-value than expected
- operator interviews show that actual adoption is bottlenecked by a different surface than the current plan assumes
- external ecosystem changes materially alter which frameworks or commerce layers matter most

Absent that evidence, this priority order stands.

## Current shipped state informing this decision

- MCP server is live and published: `@aegis-protocol/mcp-server`
- LangChain integration exists: `sdk/packages/langchain` and `sdk/examples/langchain-agent.ts`
- CrewAI example exists: `sdk/examples/crewai-agent.py`

This matters because AEGIS already has live agent-facing surfaces. The highest-leverage
next move is to improve placement, usage, and measurement on those surfaces rather
than creating new awareness channels first.

## Rejected alternatives

### 1. Human-channel-first GTM

Rejected because it creates awareness but does not reliably place AEGIS in the tool
surfaces where agent decisions are actually made.

### 2. Social-ambassador-first GTM

Rejected as a primary strategy because it is more likely to produce visibility than
real usage unless coupled to clear instrumentation and attributable conversion.

### 3. Mem0 as a primary discovery layer

Rejected as a primary strategy because current evidence supports it as a memory and
retrieval primitive, not as a reliable public-distribution layer for AEGIS adoption.

## Source inputs

- [agent-native-distribution-v2.md](/Users/shamimrehman/Projects/aegis-protocol/content/agent-native-distribution-v2.md)
- [agent-promotion-playbook.md](/Users/shamimrehman/Projects/aegis-protocol/content/agent-promotion-playbook.md)
- Current shipped agent surfaces in the AEGIS repo:
  - `mcp/`
  - `sdk/packages/langchain`
  - `sdk/examples/crewai-agent.py`
- Strategy critique and synthesis from the March 6, 2026 Codex discussion

## Guidance for future sessions

If a future LLM needs to decide what AEGIS should do next on distribution, start here.

The default assumption should be:

- prioritize real external usage
- prefer live agent decision surfaces over speculative channels
- treat awareness-only tactics as secondary until they prove attributable usage impact
