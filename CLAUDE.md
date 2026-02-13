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

## Addresses (Base Sepolia)

- USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- USDC (Base Mainnet): `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- ERC-8004 Registries: TBD (need to find/deploy on Base — EIP is 2 weeks old)

## Implementation Roadmap

### Phase 1: Core Contracts ✅ (CURRENT — code written, needs compile/test)
- [x] AegisEscrow.sol with full state machine
- [x] ERC-8004 interface definitions (Identity, Reputation, Validation)
- [x] AegisTypes.sol shared library
- [x] AegisTreasury.sol
- [x] AegisDispute.sol with 3-tier resolution
- [x] AegisJobFactory.sol with templates
- [x] Mock ERC-8004 registries for testing
- [x] Comprehensive test suite (25 tests + fuzz)
- [x] Deploy script for Base Sepolia
- [ ] **NEXT: Compile, fix any errors, get all tests passing**
- [ ] Gas optimization pass
- [ ] Deploy mocks + AEGIS to Base Sepolia testnet

### Phase 2: SDK & Developer Experience (Weeks 9-12)
- [ ] TypeScript SDK (`@aegis/sdk`)
- [ ] Python SDK (`@aegis/python`)
- [ ] Subgraph (The Graph) for indexing
- [ ] REST API wrapper
- [ ] Integration examples (AutoGPT, CrewAI, LangChain)

### Phase 3: Mainnet Launch (Weeks 13-16)
- [ ] Security audit
- [ ] Base mainnet deployment
- [ ] Partner integrations
- [ ] ERC extension proposal

## Competitive Landscape

Nobody else composes ERC-8004 + x402:
- **Circle AI Escrow**: Experimental, human-in-loop, Circle APIs only, not composable
- **AgentEscrowProtocol (GitHub)**: Single dev, own basic reputation, no ERC-8004
- **Kite Protocol**: Own L1 blockchain (different bet entirely)
- **Coral Protocol**: Session vaults with policy contracts, no standard integration
- **Virtuals Protocol**: Agent launchpad, not escrow middleware

Our moat: every agent that registers with ERC-8004 is a potential AEGIS user. Data flywheel — every settled job generates reputation data that makes the ecosystem smarter.

## Key Reference Docs

- `docs/ERC-8004-SPEC.md` — Complete ERC-8004 specification notes
- `docs/ARCHITECTURE.md` — Full architecture decisions and rationale
- `docs/COMPETITIVE-ANALYSIS.md` — Detailed competitor breakdown
