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
- **10 tools**: create_job, deliver_work, check_job, settle_job, open_dispute, claim_refund, lookup_agent, list_jobs, check_balance, get_template
- **Dual mode**: Read-only (returns unsigned tx calldata) or signing (executes directly with `AEGIS_PRIVATE_KEY`)
- **Transport**: Stdio (Claude Desktop) — primary
- **Config env vars**: `AEGIS_CHAIN`, `AEGIS_RPC_URL`, `AEGIS_PRIVATE_KEY` (optional), `AEGIS_API_URL` (optional)
- **Build/Test**: `cd mcp && pnpm build` / `cd mcp && pnpm test`
- **LLM-optimized**: Tool descriptions explain *when* to use escrow, not just *how*

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

# Test (25 tests including fuzz)
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

## Addresses (Base Sepolia) — Deployed 2026-02-18

| Contract | Address |
|----------|---------|
| AegisEscrow | `0xD5140b684Ea05a9e5fB6090cb89ED53eeE22A42a` |
| AegisDispute | `0xEA82d5142557CD5B63EFDE17a0a62AC913abE4a0` |
| AegisTreasury | `0x7977a4F05b2a93738b4aBb2b29328c8d0666FF2A` |
| AegisJobFactory | `0x9A9821B35D1Cd7fC38f02daEF5BE4B1a77954a29` |
| MockIdentityRegistry | `0x3365f24bC393e7B8Fd7c05B2B038916D4B043167` |
| MockReputationRegistry | `0x8f354D60D8f12bf1339DbAC02F84F0bdf292F39D` |
| MockValidationRegistry | `0x63e89bE524b338c32BFd5752e199362b77F895Ad` |
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
- [x] Comprehensive test suite (202 tests including fuzz — all passing)
- [x] Deploy script for Base Sepolia
- [x] Compile clean (zero errors)
- [x] All 202 tests passing across 5 test suites
- [x] Gas report reviewed — all functions economically viable on Base L2
- [x] Deployed mocks + AEGIS to Base Sepolia testnet

### Phase 2: SDK & Developer Experience ✅
- [x] TypeScript SDK (`@aegis-protocol/sdk`) — PR #1 merged
- [x] SDK integration tests against Base Sepolia — PR #2 merged
- [x] SDK DX enhancements — PR #3 merged
- [x] Subgraph (The Graph) for full event indexing — PR #4 merged
- [x] REST API relay server — PR #5 merged
- [ ] Python SDK
- [ ] Integration examples (AutoGPT, CrewAI, LangChain)

### Phase 2.5: Agent-Native Distribution (Parallel with Phase 2)
- [x] AEGIS MCP Server (Model Context Protocol) — highest priority agent distribution channel
  - 10 tools: aegis_create_job, aegis_deliver_work, aegis_check_job, aegis_settle_job, aegis_open_dispute, aegis_claim_refund, aegis_lookup_agent, aegis_list_jobs, aegis_check_balance, aegis_get_template
  - LLM-optimized tool descriptions (explain *when* to use escrow, not just *how*)
  - Dual mode: read-only (unsigned tx) or signing (direct execution)
  - [ ] Test with Claude Desktop, Gemini, GPT
  - [ ] Publish to MCP registries and npm
- [ ] A2A Agent Card (`/.well-known/agent-card.json`) — agent discovery via Google A2A protocol
- [ ] ERC-8004 Identity Registration — register AEGIS as a service agent in the registry
- [ ] Agent framework integrations: AutoGPT (P0), CrewAI (P0), LangChain (P0), OpenClaw (P1)

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

- **GTM Strategy**: Developer-first, standards-native organic growth. See `AEGIS_Strategic_Research_Brief.md` for full execution plan.
- **Primary distribution channels**: MCP Server (highest priority), A2A Agent Cards, ERC-8004 registry, agent framework integrations
- **Licensing**: MIT License for all code (contracts, SDK, API, subgraph). Revenue is from protocol fees, not software licensing.
- **Audit plan**: Sherlock competitive audit contest (public). Start Sherlock AI GitHub integration during development.
- **Grant targets**: Base Builder Grants (apply at testnet deploy), Base Batches 2026, Ethereum Foundation ESP, x402 Foundation, Optimism RetroPGF
- **Go-public timing**: Repo goes public at Base Sepolia testnet deployment (scrub git history for secrets first)
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
- `docs/plans/2026-02-18-python-sdk-design-wip.md` — Python SDK design (paused, resume after MCP Server)
- `TASKS.md` — Master task list with priorities and sequencing
