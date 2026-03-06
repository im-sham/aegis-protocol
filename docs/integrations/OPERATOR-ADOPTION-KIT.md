# Operator Default-Placement Kit

Last reviewed: 2026-03-06

## Purpose

This document is the practical adoption kit for maintainers, workflow builders, and
operators who want to place AEGIS into a default or recommended path for external-agent work.

Use this alongside:
- `content/agent-promotion-playbook.md` for distribution strategy
- `docs/decisions/2026-03-06-agent-first-distribution.md` for rationale

This document is execution-facing. It is designed to reduce friction for:
- framework maintainers evaluating whether AEGIS belongs in their recommended patterns
- operators wiring external-specialist workflows into live agent systems
- future LLM sessions that need the current canonical insertion guidance

## Canonical Positioning

AEGIS is the trust and settlement layer for agent-to-agent work when direct payment is too risky.

Short version:
- use direct payment for trivial, low-value, instantly verifiable work
- use AEGIS when value is meaningful, the counterparty is unknown, or the deliverable needs validation before release of funds

## Default Decision Rule

Treat AEGIS as the default recommendation when any of the following is true:
- transaction value is at least `$50`
- the provider is new or low-reputation
- the deliverable requires objective validation before payment
- the work involves code, audits, research, strategy, trading, or integrations

Treat AEGIS as optional or unnecessary when all of the following are true:
- value is low
- the provider is known and trusted
- the deliverable is trivial to verify immediately

## Canonical Tool Order

Use this order in prompts, docs, examples, and recommended workflows:

1. `aegis_should_i_escrow`
2. `aegis_lookup_agent`
3. `aegis_check_balance`
4. `aegis_create_job`
5. `aegis_submit_deliverable`
6. `aegis_settle_job`

Do not start the operator at `aegis_create_job` unless the decision to use escrow has already been made elsewhere in the flow.

## Attribution Standard

When usage logging is enabled, examples and operator setups should pass attribution metadata so demo traffic and real operator traffic are separable.

Recommended envs:
- `AEGIS_USAGE_LOG_PATH`: JSONL destination for usage records
- `AEGIS_USAGE_SOURCE`: integration or runtime label
- `AEGIS_USAGE_ACTOR`: operator or team label
- `AEGIS_USAGE_CONTEXT`: free-form run context such as `demo`, `staging`, `production`, or campaign labels

Recommended `AEGIS_USAGE_SOURCE` values:
- `mcp`
- `crewai-example`
- `langchain-example`
- `elizaos-plugin`
- `virtuals-game`
- `custom-operator`

Rule:
- never count unlabeled demos as production adoption if attribution is available

## Copy Blocks

### One-line description

`AEGIS adds escrow, validation, and dispute resolution to high-value agent transactions.`

### Two-sentence description

`AEGIS is the trust layer for agent-to-agent work when direct payment is too risky. It lets agents decide when to escrow funds, validate deliverables, and settle only after work quality is confirmed.`

### Decision-oriented insertion text

`Use AEGIS when an external-agent task is high-value, handled by an unknown provider, or requires objective validation before payment release.`

### What not to claim

Do not claim:
- that all agent transactions need escrow
- that demo traffic equals adoption
- that AEGIS replaces native commerce protocols
- that AEGIS removes operator responsibilities such as wallet setup, allowlists, or registry configuration

## Framework Insertion Points

### MCP

Best use:
- default tool catalog for agents that can call MCP tools directly

Recommended operator framing:
- make `aegis_should_i_escrow` the documented entry point
- describe the rest of the tools as the execution path after that decision
- stamp attribution envs whenever logging is enabled

Minimal config notes:
- point `AEGIS_CHAIN` at `base-sepolia` or `base`
- pass `AEGIS_RPC_URLS` if you have dedicated endpoints
- set `AEGIS_PRIVATE_KEY` only for write-enabled environments

### LangChain

Best use:
- multi-step agents that choose tools during outsourced work or specialist-agent handoff flows

Default placement target:
- include `aegis_should_i_escrow` in the first recommended tool sequence for any high-value external task

Recommended system guidance:

```text
Before sending funds or creating external work, call aegis_should_i_escrow if the task is meaningful in value, handled by a new provider, or requires validation before payment. If escrow is recommended, continue with aegis_lookup_agent and aegis_check_balance before creating the job.
```

### CrewAI

Best use:
- crews that need to decide whether to hire or pay an external specialist

Default placement target:
- add AEGIS MCP access to the operator or coordinator agent, not only the specialist
- make the task description explicitly call for `aegis_should_i_escrow` before write actions

Recommended task instruction:

```text
Use AEGIS tools before approving or creating any external-agent payment. Start with aegis_should_i_escrow, then verify the counterparty and wallet state before creating escrow.
```

### ElizaOS

Best use:
- Web3-native agent stacks with plugin-driven action catalogs

Default placement target:
- include the AEGIS plugin in the base character/plugin bundle for agents that outsource work
- keep the system prompt explicit about when escrow should be used

Recommended system line:

```text
Use AEGIS actions whenever outsourced work is high-value, counterparty trust is uncertain, or the deliverable needs objective validation before payment release.
```

### Virtuals (GAME / ACP)

Best use:
- agent-commerce flows where ACP handles discovery and negotiation, while AEGIS acts as the trust layer for riskier work

Default placement target:
- include AEGIS resources and schemas in operator ACP profiles
- include the AEGIS prompt block in the GAME agent description
- route high-value or validation-sensitive offerings toward AEGIS-backed settlement patterns

Operator note:
- AEGIS does not replace ACP onboarding. Wallet whitelist, agent profile, and registry setup remain operator tasks.

## Operator Checklist

Before calling an integration “adoption-ready,” verify:

1. `aegis_should_i_escrow` is documented as the first decision step.
2. Counterparty verification (`aegis_lookup_agent`) is present in the happy path.
3. Funding/allowance checks are present before write actions.
4. Usage attribution envs are defined if logging is enabled.
5. Demo, staging, and production contexts are distinguishable.
6. The doc or prompt explains when not to use AEGIS.
7. The operator knows which tasks are still theirs to handle manually.

## Maintainer Ask

The default ask to framework maintainers should be narrow:
- include AEGIS in the recommended pattern for external-agent work above a threshold
- include the advisory entry point in sample prompts or starter templates
- avoid asking for deep protocol commitments before proving real usage

## Source Notes

Primary sources checked on 2026-03-06:
- CrewAI MCP docs: `docs.crewai.com`
- LangChain tool and agent docs: `docs.langchain.com`
- ElizaOS plugin docs: `eliza.how`
- Virtuals GAME + ACP docs: `docs.game.virtuals.io`, `whitepaper.virtuals.io`

If framework guidance changes materially, update this kit before revising examples or outreach copy.
