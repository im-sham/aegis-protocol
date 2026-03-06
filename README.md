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
| AegisEscrow | [`0x8e013cf23f11168B62bA2600d99166507Cbb4aAC`](https://sepolia.basescan.org/address/0x8e013cf23f11168B62bA2600d99166507Cbb4aAC) |
| AegisDispute | [`0x9Cbe0bf5080568F56d61F4F3ef0f64909898DcB2`](https://sepolia.basescan.org/address/0x9Cbe0bf5080568F56d61F4F3ef0f64909898DcB2) |
| AegisTreasury | [`0xCd2a996Edd6Be2992063fD2A41c0240D77c9e0AA`](https://sepolia.basescan.org/address/0xCd2a996Edd6Be2992063fD2A41c0240D77c9e0AA) |
| AegisJobFactory | [`0xD6a9fafA4d1d233075D6c5de2a407942bdc29dbF`](https://sepolia.basescan.org/address/0xD6a9fafA4d1d233075D6c5de2a407942bdc29dbF) |

## Quick Start

### For AI Agents (MCP Server)

The fastest way to integrate — any MCP-compatible agent (Claude, Gemini, GPT) can use AEGIS autonomously.

```bash
npm install @aegis-protocol/mcp-server
```

11 tools available: `aegis_create_job`, `aegis_deliver_work`, `aegis_check_job`, `aegis_settle_job`, `aegis_open_dispute`, `aegis_claim_refund`, `aegis_lookup_agent`, `aegis_list_jobs`, `aegis_check_balance`, `aegis_get_template`, `aegis_should_i_escrow`

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

### For Developers (LangChain / LangGraph)

```bash
npx -y pnpm@9.15.4 -C sdk --filter @aegis-protocol/examples langchain-agent -- "Check agent 1 reputation and summarize escrow risk."
```

LangChain tool adapters are available in `sdk/packages/langchain` and can be imported as:

```typescript
import { createAegisLangChainTools } from "@aegis-protocol/langchain";
```

The native LangChain adapter now includes the advisory entry point `aegis_should_i_escrow` plus settlement support, so the agent-first funnel matches MCP, ElizaOS, and Virtuals.

### For Developers (CrewAI)

Install Python dependencies (one-time):

```bash
python3 -m pip install crewai mcp
```

Run the CrewAI + MCP example:

```bash
OPENAI_API_KEY=... python3 sdk/examples/crewai-agent.py "Check agent 1 reputation and summarize escrow risk."
```

Or through the examples workspace script:

```bash
npx -y pnpm@9.15.4 -C sdk --filter @aegis-protocol/examples crewai-agent -- "Check agent 1 reputation and summarize escrow risk."
```

The example uses CrewAI's MCP integration (`MCPServerStdio`) to call the published `@aegis-protocol/mcp-server` tools directly.
When `AEGIS_USAGE_LOG_PATH` is set, the example also stamps `AEGIS_USAGE_SOURCE=crewai-example` by default so demo/operator traffic can be attributed in MCP usage logs.

### For Developers (ElizaOS)

Run the ElizaOS example config summary:

```bash
npx -y pnpm@9.15.4 -C sdk --filter @aegis-protocol/examples eliza-character
```

The ElizaOS plugin package is available in `sdk/packages/elizaos` and can be imported as:

```typescript
import { createAegisElizaPlugin } from "@aegis-protocol/elizaos";
```

The example exports a minimal character/plugin config in `sdk/examples/eliza-character.ts` and includes:

- advisory action entry point: `AEGIS_SHOULD_I_ESCROW`
- trust and funding checks: `AEGIS_LOOKUP_AGENT`, `AEGIS_CHECK_BALANCE`
- write-path actions for signer-enabled runtimes: `AEGIS_APPROVE_ESCROW`, `AEGIS_CREATE_JOB`, `AEGIS_SUBMIT_DELIVERABLE`, `AEGIS_SETTLE_JOB`

### For Developers (Virtuals GAME / ACP)

Run the Virtuals config summary:

```bash
npx -y pnpm@9.15.4 -C sdk --filter @aegis-protocol/examples virtuals-agent
```

The Virtuals adapter package is available in `sdk/packages/virtuals` and can be imported as:

```typescript
import {
  createAegisVirtualsWorker,
  createAegisVirtualsPrompt,
  createAegisAcpSchemas,
  createAegisAcpResources,
} from "@aegis-protocol/virtuals";
```

The example exports a minimal Virtuals-ready config in `sdk/examples/virtuals-agent.ts` and includes:

- GAME worker functions for AEGIS advisory/read/write flows
- ACP custom requirement/deliverable schemas aligned to AEGIS job creation
- ACP resource entries that point operators back to AEGIS docs/MCP surfaces
- explicit separation between agent runtime logic and the operator-owned ACP wallet/registry setup

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

# Run tests
forge test -vvv

# Run invariants only
forge test --match-path "test/invariants/*" -vvv

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
├── test/                   # Foundry tests (unit, fuzz, invariants)
├── script/                 # Deploy & E2E demo scripts
├── sdk/                    # TypeScript SDK monorepo
│   └── packages/
│       ├── sdk/            # @aegis-protocol/sdk
│       ├── langchain/      # @aegis-protocol/langchain
│       ├── elizaos/        # @aegis-protocol/elizaos
│       ├── virtuals/       # @aegis-protocol/virtuals
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

- 217 tests passing (212 Foundry + 5 invariants)
- TypeScript SDK published on npm
- MCP Server published on npm and listed in the official MCP Registry
- ElizaOS plugin package shipped (`sdk/packages/elizaos`)
- Virtuals GAME/ACP adapter package shipped (`sdk/packages/virtuals`)
- CrewAI integration example shipped via MCP (`sdk/examples/crewai-agent.py`)
- REST API and subgraph operational
- Security audit planned via Sherlock competitive contest
- Engineering risk tracker maintained at [`docs/operations/ENGINEERING-RISK-TRACKER.md`](docs/operations/ENGINEERING-RISK-TRACKER.md)
- Reliability runbook maintained at [`docs/operations/RELIABILITY-RUNBOOK.md`](docs/operations/RELIABILITY-RUNBOOK.md)

## Contributing

AEGIS is open source under the MIT License. Contributions welcome — see the [open issues](https://github.com/im-sham/aegis-protocol/issues) or reach out.

## License

[MIT](LICENSE)
