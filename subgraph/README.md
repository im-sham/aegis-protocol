# AEGIS Protocol Subgraph

Indexes on-chain events from the four AEGIS Protocol contracts on Base Sepolia and exposes them through a GraphQL API. Built with [The Graph Protocol](https://thegraph.com/).

Queryable data includes jobs, disputes, arbitrators, job templates, and protocol-wide statistics.

## Architecture

**Data Sources (4 contracts)**

| Contract | Mapping |
|----------|---------|
| AegisEscrow | `src/escrow.ts` |
| AegisDispute | `src/dispute.ts` |
| AegisTreasury | `src/treasury.ts` |
| AegisJobFactory | `src/factory.ts` |

**Schema**

- 6 mutable aggregation entities: `Job`, `Dispute`, `Arbitrator`, `JobTemplate`, `ProtocolStats`, `DailyStats`
- 35 immutable event entities for full event history
- Mustache templates (`subgraph.template.yaml`) for multi-network support

## Quick Start

```bash
# Install dependencies
npm install

# Prepare manifest (Base Sepolia)
npm run prepare:base-sepolia

# Generate AssemblyScript types from schema + ABIs
npm run codegen

# Build WASM modules
npm run build

# Run Matchstick unit tests
npm run test
```

## Deploy to Subgraph Studio

```bash
# Authenticate with your deploy key from https://thegraph.com/studio/
graph auth --studio <DEPLOY_KEY>

# Prepare the manifest for the target network
npm run prepare:base-sepolia

# Generate types and build
npm run codegen && npm run build

# Deploy
graph deploy --studio aegis-protocol --version-label v0.1.0
```

## Network Configuration

| Network | Config File | Status |
|---------|-------------|--------|
| Base Sepolia | `config/base-sepolia.json` | Active |
| Base Mainnet | `config/base.json` | Placeholder (addresses zeroed) |

To add a new network, create a JSON config in `config/` following the same shape and add a corresponding `prepare:<network>` script to `package.json`.

## Contract Addresses (Base Sepolia)

| Contract | Address | Start Block |
|----------|---------|-------------|
| AegisEscrow | `0xe988128467299fD856Bb45D2241811837BF35E77` | 37617228 |
| AegisDispute | `0x2c831D663B87194Fa6444df17A9A7d135186Cb41` | 37617228 |
| AegisTreasury | `0xE64D271a863aa1438FBb36Bd1F280FA1F499c3f5` | 37617228 |
| AegisJobFactory | `0xFD451BEfa1eE3EB4dBCA4E9EA539B4bf432866dA` | 37617228 |

## Example Queries

**Jobs for a client agent:**

```graphql
query JobsByClient($clientAgentId: BigInt!) {
  jobs(
    where: { clientAgentId: $clientAgentId }
    orderBy: createdAt
    orderDirection: desc
  ) {
    id
    state
    amount
    providerAgentId
    createdAt
    settledAt
  }
}
```

**Protocol stats:**

```graphql
{
  protocolStats(id: "protocol") {
    totalJobs
    totalSettled
    totalDisputed
    totalVolumeUSDC
    totalFeesCollected
    activeArbitrators
  }
}
```

**Recent disputes with details:**

```graphql
{
  disputes(first: 10, orderBy: createdAt, orderDirection: desc) {
    id
    job {
      id
      amount
      state
    }
    initiator
    arbitrator
    resolved
    method
    clientPercent
  }
}
```

## Project Structure

```
subgraph/
  abis/                        # Contract ABIs (JSON)
    AegisEscrow.json
    AegisDispute.json
    AegisTreasury.json
    AegisJobFactory.json
  config/                      # Network configs for Mustache templating
    base-sepolia.json
    base.json
  src/                         # AssemblyScript event handlers
    escrow.ts                  #   AegisEscrow handlers (16 events)
    dispute.ts                 #   AegisDispute handlers (10 events)
    treasury.ts                #   AegisTreasury handlers (5 events)
    factory.ts                 #   AegisJobFactory handlers (4 events)
    helpers.ts                 #   Shared utilities (entity loading, stats)
  tests/                       # Matchstick unit tests
    escrow.test.ts
    dispute.test.ts
    treasury.test.ts
    factory.test.ts
  schema.graphql               # Entity definitions (6 mutable + 35 immutable)
  subgraph.template.yaml       # Mustache template for manifest
  subgraph.yaml                # Generated manifest (do not edit directly)
  package.json
  tsconfig.json
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `@graphprotocol/graph-cli` | Build, codegen, and deploy CLI |
| `@graphprotocol/graph-ts` | AssemblyScript runtime library |
| `matchstick-as` | Unit testing framework (dev) |
| `mustache` | Template rendering for multi-network manifests (dev) |
