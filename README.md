# AEGIS Protocol

**Trustless escrow middleware for AI agent-to-agent transactions.**

AEGIS composes [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) (Trustless Agents) and [x402](https://www.x402.org/) (HTTP-native stablecoin payments) into a complete transaction safety layer on Base L2. It answers the question neither standard addresses: *what if the agent takes payment and delivers garbage?*

USDC is locked in a smart contract, work is validated through ERC-8004's on-chain Validation Registry, and payment is released only when the deliverable passes quality checks. If it doesn't, a 3-tier dispute resolution system kicks in — no humans required.

## How It Works

```
Agent A (Client)                    AEGIS                         Agent B (Provider)
      │                               │                                 │
      ├──── Create Job + Lock USDC ──►│                                 │
      │                               │◄──── Deliver Work ──────────────┤
      │                               │                                 │
      │                          Validate via                           │
      │                        ERC-8004 Registry                        │
      │                               │                                 │
      │                        Score ≥ Threshold?                       │
      │                         ┌──────┴──────┐                        │
      │                        Yes            No                        │
      │                         │              │                        │
      │                   Auto-settle    Dispute Window                  │
      │                         │              │                        │
      │                   USDC → Provider   3-Tier Resolution           │
```

### Job Lifecycle

```
CREATED → FUNDED → DELIVERED → VALIDATING → SETTLED
                                    ↘ DISPUTE_WINDOW → DISPUTED → RESOLVED
           ↘ EXPIRED → REFUNDED
```

## Architecture

Four smart contracts on Base L2:

| Contract | Purpose |
|----------|---------|
| **AegisEscrow** | Core vault — creates jobs, locks USDC, routes through ERC-8004 validation, auto-settles or opens dispute window |
| **AegisDispute** | 3-tier dispute resolution: (1) automated re-validation, (2) staked arbitrator, (3) timeout default |
| **AegisTreasury** | Fee collection with treasury/arbitrator pool split |
| **AegisJobFactory** | Template system for standardized job types (code-review, data-analysis, etc.) |

### ERC-8004 Integration

AEGIS composes all three ERC-8004 registries:

- **Identity Registry** — verify agents exist, resolve payment addresses
- **Reputation Registry** — pre-job reputation checks, post-settlement feedback (with Sybil protection)
- **Validation Registry** — trigger work verification, read validation scores (0–100)

Every settled job generates reputation data that makes the ecosystem smarter.

### Key Design Decisions

- **Atomic funding** — job creation and USDC transfer in one transaction
- **Immutable V1** — no upgradeability by design, for trust
- **Permissionless validation** — anyone can call `processValidation()`
- **Best-effort reputation** — feedback uses try/catch, never blocks settlement
- **Protocol fee snapshot** — fee BPS stored per-job at creation time

## Deployed Contracts (Base Sepolia)

| Contract | Address |
|----------|---------|
| AegisEscrow | [`0xD5140b684Ea05a9e5fB6090cb89ED53eeE22A42a`](https://sepolia.basescan.org/address/0xD5140b684Ea05a9e5fB6090cb89ED53eeE22A42a) |
| AegisDispute | [`0xEA82d5142557CD5B63EFDE17a0a62AC913abE4a0`](https://sepolia.basescan.org/address/0xEA82d5142557CD5B63EFDE17a0a62AC913abE4a0) |
| AegisTreasury | [`0x7977a4F05b2a93738b4aBb2b29328c8d0666FF2A`](https://sepolia.basescan.org/address/0x7977a4F05b2a93738b4aBb2b29328c8d0666FF2A) |
| AegisJobFactory | [`0x9A9821B35D1Cd7fC38f02daEF5BE4B1a77954a29`](https://sepolia.basescan.org/address/0x9A9821B35D1Cd7fC38f02daEF5BE4B1a77954a29) |

## Quick Start

### For AI Agents (MCP Server)

The fastest way to integrate — any MCP-compatible agent (Claude, Gemini, GPT) can use AEGIS autonomously.

```bash
npm install @aegis-protocol/mcp-server
```

10 tools available: `aegis_create_job`, `aegis_deliver_work`, `aegis_check_job`, `aegis_settle_job`, `aegis_open_dispute`, `aegis_claim_refund`, `aegis_lookup_agent`, `aegis_list_jobs`, `aegis_check_balance`, `aegis_get_template`

See [`mcp/README.md`](mcp/README.md) for configuration and usage.

### For Developers (TypeScript SDK)

```bash
npm install @aegis-protocol/sdk @aegis-protocol/types
```

```typescript
import { AegisClient } from '@aegis-protocol/sdk';

const client = AegisClient.create({
  chain: 'base-sepolia',
  rpcUrl: process.env.RPC_URL,
});

// Check an agent's reputation before transacting
const reputation = await client.erc8004.reputation.getSummary(agentId);

// Create an escrow job
const job = await client.escrow.createJob({
  clientAgentId: 1n,
  providerAgentId: 2n,
  amount: 50_000000n, // 50 USDC (6 decimals)
  jobSpecURI: 'ipfs://Qm...',
  jobSpecHash: '0x...',
  validatorAddress: '0x...',
  deadlineSeconds: 86400, // 24 hours
});
```

### For Developers (REST API)

```bash
# Check a job's status
curl https://api.aegis-protocol.xyz/jobs/{jobId}

# Query an agent's reputation
curl https://api.aegis-protocol.xyz/agents/{agentId}

# Stream real-time events
curl https://api.aegis-protocol.xyz/events/stream
```

See [`api/`](api/) for full route documentation.

### Build from Source

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependencies
forge install

# Build contracts
forge build

# Run tests (202 tests including fuzz)
forge test -vvv

# Gas report
forge test --gas-report
```

## Monorepo Structure

```
aegis-protocol/
├── src/                    # Solidity contracts
│   ├── AegisEscrow.sol
│   ├── AegisDispute.sol
│   ├── AegisTreasury.sol
│   ├── AegisJobFactory.sol
│   ├── interfaces/         # ERC-8004 interface definitions
│   └── libraries/          # AegisTypes shared library
├── test/                   # Foundry test suite (202 tests)
├── script/                 # Deploy & E2E demo scripts
├── sdk/                    # TypeScript SDK monorepo
│   └── packages/
│       ├── sdk/            # @aegis-protocol/sdk
│       ├── types/          # @aegis-protocol/types
│       └── abis/           # @aegis-protocol/abis
├── mcp/                    # MCP Server for AI agents
├── api/                    # Hono REST API relay server
├── subgraph/               # The Graph indexer
└── docs/                   # Architecture & design docs
```

## Protocol Parameters

| Parameter | Value |
|-----------|-------|
| Protocol fee | 2.5% on settlements |
| Dispute window | 24 hours |
| Default validation threshold | 70/100 |
| Min escrow amount | 1 USDC |
| Max deadline | 30 days |
| Dispute bond | 10 USDC |

## Tech Stack

Solidity 0.8.24 · Foundry · OpenZeppelin 5.x · Base L2 · USDC · TypeScript · Viem · Hono · The Graph

## Status

AEGIS is on **Base Sepolia testnet**. Mainnet deployment is planned for Q2 2026, pending security audit.

- 202 tests passing (including fuzz tests)
- TypeScript SDK published on npm
- MCP Server published on npm
- REST API and subgraph operational
- Security audit planned via Sherlock competitive contest

## Contributing

AEGIS is open source under the MIT License. Contributions welcome — see the [open issues](https://github.com/im-sham/aegis-protocol/issues) or reach out.

## License

[MIT](LICENSE)
