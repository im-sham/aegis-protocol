# AEGIS Protocol — Claude Code Project Context

## What This Is

AEGIS (Agent Escrow & Governance Infrastructure Standard) is trustless escrow middleware for AI agent-to-agent transactions. It composes two bleeding-edge standards:

- **ERC-8004** (Trustless Agents, mainnet Jan 29 2026) — on-chain agent identity, reputation, and work validation
- **x402** (Coinbase, V2 Dec 2025) — HTTP-native stablecoin payments for AI agents

AEGIS answers the question neither standard addresses: **"What if the agent takes payment and delivers garbage?"**

**One-liner:** "AEGIS is to the agent economy what Stripe was to e-commerce — the trust layer that makes autonomous transactions safe enough to happen at scale."

## Core Architecture

### Contract Stack (4 contracts, Solidity 0.8.24, Foundry, Base L2)

| Contract | Purpose |
|----------|---------|
| `AegisEscrow.sol` | Core vault. Creates jobs, locks USDC, routes through ERC-8004 Validation Registry, auto-settles or opens dispute window |
| `AegisDispute.sol` | 3-tier dispute resolution: (1) automated re-validation, (2) staked arbitrator, (3) timeout default |
| `AegisTreasury.sol` | Fee collection with treasury/arbitrator pool split |
| `AegisJobFactory.sol` | Template system for standardized job types (code-review, data-analysis, etc.) |

### Job State Machine

```
CREATED → FUNDED → DELIVERED → VALIDATING → SETTLED
                                    ↘ DISPUTE_WINDOW → DISPUTED → RESOLVED
           ↘ EXPIRED → REFUNDED
CREATED → CANCELLED (before funding)
```

### ERC-8004 Integration (Critical — This Is Our Moat)

**READS from ERC-8004:**
- Identity Registry: `ownerOf()`, `getAgentWallet()` — verify agents exist, resolve payment addresses
- Reputation Registry: `getSummary()` — pre-job reputation check (REQUIRES clientAddresses array to prevent Sybil)
- Validation Registry: `getValidationStatus()` — read work validation scores (0-100)

**WRITES to ERC-8004:**
- Reputation Registry: `giveFeedback()` — auto-submit on every settlement with proof-of-payment
- Validation Registry: `validationRequest()` — trigger work verification on deliverable submission

### Key Design Decisions

1. **Atomic funding**: Job creation and USDC transfer happen in the same tx (no separate fund step)
2. **Permissionless validation processing**: Anyone can call `processValidation()` — reads on-chain state
3. **Best-effort reputation**: Feedback submission uses try/catch — never blocks settlement
4. **Immutable V1**: No upgradeability by design for trust. Future versions deploy as new contracts
5. **Provider wallet from ERC-8004**: Payments go to `getAgentWallet()`, not msg.sender
6. **Protocol fee snapshot**: Fee BPS stored per-job at creation time (immune to admin changes mid-job)

## Monorepo Structure

Root `pnpm-workspace.yaml` links: `sdk/`, `sdk/packages/*`, `api/`, `mcp/`
- SDK: `@aegis-protocol/sdk`, `@aegis-protocol/types`, `@aegis-protocol/abis`
- API: `@aegis-protocol/api` (Hono relay server)
- MCP: `@aegis-protocol/mcp-server` (Model Context Protocol server)
- Subgraph: `subgraph/` (The Graph, AssemblyScript)

## MCP Server (mcp/)

MCP server enabling AI agents to autonomously use AEGIS escrow via the Model Context Protocol.
- **11 tools**: create_job, deliver_work, check_job, settle_job, open_dispute, claim_refund, lookup_agent, list_jobs, check_balance, get_template, should_i_escrow
- **Dual mode**: Read-only (returns unsigned tx calldata) or signing (executes directly with `AEGIS_PRIVATE_KEY`)
- **Transport**: Stdio (Claude Desktop) — primary
- **Config env vars**: `AEGIS_CHAIN`, `AEGIS_RPC_URL`, `AEGIS_RPC_URLS`, `AEGIS_PRIVATE_KEY` (optional), `AEGIS_API_URL` (optional)
- **Build/Test**: `cd mcp && pnpm build` / `cd mcp && pnpm test`
- **Current priority**: optimize tool descriptions and usage instrumentation for external agent adoption
- **LLM-optimized**: Tool descriptions should explain *when* to use escrow, not just *how*

## API Package (api/)

Hono HTTP relay server — AI agents interact with AEGIS without importing Web3 SDK.
- **Read routes**: jobs, disputes, templates, agents (ERC-8004), USDC, treasury
- **Write route**: POST /tx/relay (accepts pre-signed tx, validates against contract whitelist, broadcasts)
- **SSE**: GET /events/stream (real-time on-chain events with filters)
- **Test**: `cd api && npx vitest run` (run from api/ dir, NOT repo root)
- **Deploy**: Dockerfile + fly.toml (Fly.io, EWR region)

## Tech Stack

- **Solidity 0.8.24** with optimizer (200 runs)
- **Foundry** (forge build/test/deploy)
- **OpenZeppelin 5.x** (ReentrancyGuard, SafeERC20, Ownable, Pausable)
- **Base L2** (target deployment chain)
- **USDC** (6 decimals, ERC-20)

## Build & Test

```bash
# Install deps (first time)
forge install OpenZeppelin/openzeppelin-contracts
forge install foundry-rs/forge-std

# Build
forge build

# Test (217 tests: 212 unit/fuzz + 5 invariants)
forge test -vvv

# Gas report
forge test --gas-report

# Deploy to Base Sepolia
forge script script/Deploy.s.sol:DeployAegis \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast
```

## Protocol Parameters (Defaults)

- `protocolFeeBps`: 250 (2.5%)
- `disputeWindowSeconds`: 24 hours
- `defaultValidationThreshold`: 70/100
- `minEscrowAmount`: 1 USDC
- `maxDeadlineDuration`: 30 days
- `disputeBondAmount`: 10 USDC
- `evidenceWindowSeconds`: 48 hours
- `disputeTTLSeconds`: 7 days
- `minArbitratorStake`: 1,000 USDC

## Addresses (Base Sepolia) — Redeployed 2026-02-21 (post-BH-001 security hardening)

| Contract | Address |
|----------|---------|
| AegisEscrow | `0x8e013cf23f11168B62bA2600d99166507Cbb4aAC` |
| AegisDispute | `0x9Cbe0bf5080568F56d61F4F3ef0f64909898DcB2` |
| AegisTreasury | `0xCd2a996Edd6Be2992063fD2A41c0240D77c9e0AA` |
| AegisJobFactory | `0xD6a9fafA4d1d233075D6c5de2a407942bdc29dbF` |
| MockIdentityRegistry | `0x587Fc182dB14b059c30f8B2b553edce62D81182d` |
| MockReputationRegistry | `0x2f738B69484de79828C83e292F13Ad6EF523848a` |
| MockValidationRegistry | `0x4F15a4ce7db076F1A0159ce457AbB7D3a75BC0CD` |
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Owner/Admin | `0x31084ba014bC91D467D008e6fb21f827AC6f7eb0` |

- USDC (Base Mainnet): `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

## Implementation Roadmap

### Phase 1: Core Contracts ✅ COMPLETE — Deployed to Base Sepolia 2026-02-18
- [x] AegisEscrow.sol with full state machine
- [x] ERC-8004 interface definitions (Identity, Reputation, Validation)
- [x] AegisTypes.sol shared library
- [x] AegisTreasury.sol
- [x] AegisDispute.sol with 3-tier resolution
- [x] AegisJobFactory.sol with templates
- [x] Mock ERC-8004 registries for testing
- [x] Comprehensive test suite (217 tests: 212 unit/fuzz + 5 invariants — all passing)
- [x] Deploy script for Base Sepolia
- [x] Compile clean (zero errors)
- [x] All 217 tests passing across 6 test suites
- [x] Gas report reviewed — all functions economically viable on Base L2
- [x] Deployed mocks + AEGIS to Base Sepolia testnet
- [x] Security audit pass — 6 findings fixed (SEC-001..006), 3 hardening items (BH-001..003)
- [x] Custom error migration — all string reverts → typed errors
- [x] Invariant test suite — fund conservation, escrow solvency, state machine monotonicity

### Phase 2: SDK & Developer Experience ✅
- [x] TypeScript SDK (`@aegis-protocol/sdk`) — PR #1 merged
- [x] SDK integration tests against Base Sepolia — PR #2 merged
- [x] SDK DX enhancements — PR #3 merged
- [x] Subgraph (The Graph) for full event indexing — PR #4 merged
- [x] REST API relay server — PR #5 merged
- [x] LangChain integration example/package
- [x] CrewAI integration example (MCP-backed)
- [ ] Python SDK
- [x] ElizaOS integration (`@aegis-protocol/elizaos`)
- [x] Virtuals integration (`@aegis-protocol/virtuals`)
- [ ] AutoGPT integration (deprioritized behind ElizaOS/Virtuals unless evidence changes)

### Phase 2.5: Agent-Native Distribution (Parallel with Phase 2)
- [x] AEGIS MCP Server (Model Context Protocol) — highest priority agent distribution channel
  - 11 tools: aegis_create_job, aegis_deliver_work, aegis_check_job, aegis_settle_job, aegis_open_dispute, aegis_claim_refund, aegis_lookup_agent, aegis_list_jobs, aegis_check_balance, aegis_get_template, aegis_should_i_escrow
  - LLM-optimized tool descriptions (explain *when* to use escrow, not just *how*)
  - Dual mode: read-only (unsigned tx) or signing (direct execution)
  - [x] Test with Claude Desktop — 10 core transactional tools E2E tested against Base Sepolia (2026-02-21)
  - [x] Published to npm — @aegis-protocol/mcp-server v0.1.2
  - [x] Publish to official MCP Registry — io.github.im-sham/aegis-protocol live
  - [~] Publish to Smithery — namespace created, hosted deploy pending paid plan
- [x] A2A Agent Card (`site/.well-known/agent-card.json`) — hosted on Cloudflare at aegis-protocol.xyz
- [ ] ERC-8004 Identity Registration — register AEGIS as a service agent in the registry
- [x] MCP optimization + external usage instrumentation
- [ ] Agent framework integrations: CrewAI/LangChain distribution polish, AutoGPT (only if evidence changes), OpenClaw experiments (later)
- [x] CrewAI integration example is shipped (`sdk/examples/crewai-agent.py`)
- [x] LangChain integration package is shipped (`sdk/packages/langchain`)
- [x] ElizaOS integration package is shipped (`sdk/packages/elizaos`)
- [x] Virtuals integration package is shipped (`sdk/packages/virtuals`)

### Phase 3: Mainnet Launch (Weeks 13-16)
- [ ] Security audit (Sherlock competitive audit contest — public, ~1,500 nSLOC)
- [ ] Base mainnet deployment
- [ ] Partner integrations
- [ ] x402 escrow header extension proposal (AEGIS-ESCROW-RECOMMENDED)
- [ ] ERC extension proposal

## Competitive Landscape

Nobody else composes ERC-8004 + x402:
- **Circle AI Escrow**: Experimental, human-in-loop, Circle APIs only, not composable
- **AgentEscrowProtocol (GitHub)**: Single dev, own basic reputation, no ERC-8004
- **Kite Protocol**: Own L1 blockchain (different bet entirely)
- **Coral Protocol**: Session vaults with policy contracts, no standard integration
- **Virtuals Protocol**: Agent launchpad, not escrow middleware

Our moat: every agent that registers with ERC-8004 is a potential AEGIS user. Data flywheel — every settled job generates reputation data that makes the ecosystem smarter.

## Git Worktrees

Worktrees at `.worktrees/<branch-name>` (gitignored). Always verify `.worktrees/` is in `.gitignore`.

## Gotchas

- `workspace:*` deps don't resolve in isolated worktrees — use `vi.mock()` to stub `@aegis-protocol/*` in tests
- Run vitest from `api/` not repo root (OpenZeppelin test files get picked up otherwise)
- When dispatching subagents for file creation, use `general-purpose` type (NOT `Bash` — it lacks Write tool)
- Root `.gitignore` must include `node_modules/`

## Strategic Context

- **GTM Strategy**: Agent-native distribution optimized for external agent usage. Default assumption: distribution through agent choice architecture, not awareness-first marketing.
- **North star for the next 30-45 days**: external agent usage (`aegis_should_i_escrow`, write-path calls, non-demo jobs, repeat usage)
- **Primary distribution channels**: MCP optimization, framework defaults/integrations, on-chain discoverability, direct framework/operator adoption
- **Experiments, not pillars**: ambassador agents, memory-layer syndication, follower-growth tactics
- **Licensing**: MIT License for all code (contracts, SDK, API, subgraph). Revenue is from protocol fees, not software licensing.
- **Audit plan**: Sherlock competitive audit contest (public). Start Sherlock AI GitHub integration during development.
- **Grant targets**: Base Builder Grants (apply at testnet deploy), Base Batches 2026, Ethereum Foundation ESP, x402 Foundation, Optimism RetroPGF
- **Go-public timing**: Repo is public at github.com/im-sham/aegis-protocol (history scrubbed 2026-02-18)
- **Not competitors**: Fomolt (vertical trading app), OpenX402 (complementary payment facilitator). OpenX402 is a potential integration partner.

## Key Reference Docs

- `docs/ERC-8004-SPEC.md` — Complete ERC-8004 specification notes
- `docs/ARCHITECTURE.md` — Full architecture decisions and rationale
- `docs/COMPETITIVE-ANALYSIS.md` — Detailed competitor breakdown
- `docs/plans/2026-02-17-rest-api-design.md` — REST API architecture
- `docs/plans/2026-02-17-rest-api-plan.md` — REST API 12-task implementation plan
- `docs/plans/2026-02-17-subgraph-design.md` — Subgraph design document
- `docs/plans/2026-02-17-subgraph-plan.md` — Subgraph implementation plan (10 tasks)
- `AEGIS_Strategic_Research_Brief.md` — Living strategic research document (competitive landscape, GTM, grants, costs)
- `content/agent-native-distribution-v2.md` — Higher-level agent-native distribution thesis and priority ranking
- `content/agent-promotion-playbook.md` — Current execution playbook for agent-native adoption
- `docs/decisions/2026-03-06-agent-first-distribution.md` — Canonical rationale memo for the current strategy reset
- `docs/plans/2026-02-18-python-sdk-design-wip.md` — Python SDK design (paused, resume after MCP Server)
- `docs/security/SECURITY-TRACKER.md` — Security findings register and hardening backlog
- `docs/security/security_best_practices_report.md` — Detailed security audit narrative
- `TASKS.md` — Master task list with priorities and sequencing
