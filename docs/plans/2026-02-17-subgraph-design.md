# AEGIS Protocol Subgraph — Design Document

**Date:** 2026-02-17
**Phase:** 5 — On-Chain Indexing
**Target:** The Graph Subgraph Studio (decentralized network)
**Chain:** Base Sepolia (`base-sepolia`) → Base Mainnet (`base`)

---

## Problem

AEGIS contracts emit 28+ events across 4 contracts. Without indexing, consumers must scan blocks or rely on raw RPC calls to reconstruct job history, dispute timelines, and protocol analytics. This makes dashboards, REST APIs, and integration examples impractical.

## Solution

Deploy a subgraph to The Graph's decentralized network via Subgraph Studio. Index all events from AegisEscrow, AegisDispute, AegisTreasury, and AegisJobFactory into a queryable GraphQL API.

## Design Decisions

### 1. Subgraph Studio (not self-hosted)

Base is The Graph's #1 chain by query volume (1.2B+ queries/quarter). Subgraph Studio provides free development queries, decentralized indexing, and zero infrastructure maintenance. The same subgraph code can be self-hosted later if needed.

### 2. Mustache templates for multi-network

Following the Uniswap V3 pattern, use `subgraph.template.yaml` with `config/base-sepolia.json` and `config/base.json` for network-specific addresses and start blocks. This avoids maintaining duplicate manifests.

### 3. Dual entity pattern

- **Mutable entities** track aggregate state that changes over time (Job, Dispute, Arbitrator, ProtocolStats, DailyStats)
- **Immutable event entities** (`@entity(immutable: true)`) record individual on-chain events. These never change after creation and are optimized by graph-node for faster indexing.

### 4. Bytes IDs over String IDs

Per The Graph's performance guidance, use `Bytes!` for entity IDs wherever possible. For event entities, use `event.transaction.hash.concatI32(event.logIndex.toI32())` for unique, collision-free IDs.

### 5. @derivedFrom for all one-to-many relationships

Never store arrays directly on entities. Use `@derivedFrom` to create virtual reverse-lookup fields. This prevents the array duplication problem that kills indexing performance in time-travel queries.

### 6. indexerHints: prune: auto

Enable automatic pruning to remove archival entity versions, keeping the database lean for query performance.

---

## Project Structure

```
subgraph/
├── subgraph.template.yaml     # Mustache template manifest
├── config/
│   ├── base-sepolia.json       # Testnet: addresses + startBlock 37617228
│   └── base.json               # Mainnet: addresses + startBlock (TBD)
├── schema.graphql              # All entity definitions
├── src/
│   ├── escrow.ts               # AegisEscrow handlers (14 events)
│   ├── dispute.ts              # AegisDispute handlers (10 events)
│   ├── treasury.ts             # AegisTreasury handlers (5 events)
│   ├── factory.ts              # AegisJobFactory handlers (4 events)
│   └── helpers.ts              # ID generation, enum conversion, stats updates
├── abis/
│   ├── AegisEscrow.json
│   ├── AegisDispute.json
│   ├── AegisTreasury.json
│   └── AegisJobFactory.json
├── tests/
│   ├── escrow.test.ts          # Matchstick tests for escrow handlers
│   ├── dispute.test.ts         # Matchstick tests for dispute handlers
│   ├── treasury.test.ts        # Matchstick tests for treasury handlers
│   └── factory.test.ts         # Matchstick tests for factory handlers
├── package.json
└── tsconfig.json
```

**Dependencies:**
- `@graphprotocol/graph-cli ^0.56.0`
- `@graphprotocol/graph-ts ^0.31.0`
- `matchstick-as ^0.6.0`
- `mustache ^3.1.0` (devDependency)

---

## Entity Schema

### Mutable Aggregation Entities

#### Job (core — tracks full lifecycle)

```graphql
type Job @entity {
  id: Bytes!                        # jobId (bytes32)
  clientAgentId: BigInt!
  providerAgentId: BigInt!
  clientAddress: Bytes!
  providerWallet: Bytes!
  amount: BigInt!                   # USDC atomic units
  protocolFeeBps: BigInt!
  validatorAddress: Bytes!
  validationScore: Int!             # 0-100
  validationThreshold: Int!         # 0-100
  passedThreshold: Boolean!
  jobSpecHash: Bytes!
  jobSpecURI: String!
  deliverableHash: Bytes
  deliverableURI: String
  validationRequestHash: Bytes
  templateId: BigInt!               # 0 = custom
  state: String!                    # JobState enum as string
  resolution: String!               # DisputeResolution as string
  deadline: BigInt!
  createdAt: BigInt!
  deliveredAt: BigInt
  settledAt: BigInt
  disputeWindowEnd: BigInt
  providerAmount: BigInt            # Set on settlement
  protocolFee: BigInt               # Set on settlement
  refundAmount: BigInt              # Set on refund
  createdAtBlock: BigInt!
  createdAtTx: Bytes!

  # Derived relationships
  dispute: [Dispute!]! @derivedFrom(field: "job")
  template: JobTemplate
  events: [JobEvent!]! @derivedFrom(field: "job")
}
```

#### Dispute

```graphql
type Dispute @entity {
  id: Bytes!                        # disputeId (bytes32)
  job: Job!                         # Link to Job entity
  jobId: Bytes!
  initiator: Bytes!
  respondent: Bytes
  arbitrator: Bytes
  clientPercent: Int                # 0-100 ruling
  method: String                    # DisputeResolution as string
  resolved: Boolean!
  createdAt: BigInt!
  resolvedAt: BigInt
  createdAtBlock: BigInt!
  createdAtTx: Bytes!

  # Derived
  evidence: [EvidenceSubmittedEvent!]! @derivedFrom(field: "dispute")
}
```

#### Arbitrator

```graphql
type Arbitrator @entity {
  id: Bytes!                        # arbitrator address
  totalStaked: BigInt!
  totalSlashed: BigInt!
  disputesAssigned: BigInt!
  disputesResolved: BigInt!
  firstStakedAt: BigInt!
  lastActivityAt: BigInt!
}
```

#### JobTemplate

```graphql
type JobTemplate @entity {
  id: String!                       # templateId as string
  templateId: BigInt!
  name: String!
  creator: Bytes!
  defaultValidator: Bytes!
  defaultTimeout: BigInt!
  minValidation: Int!
  active: Boolean!
  createdAt: BigInt!
  createdAtBlock: BigInt!
  jobCount: BigInt!

  # Derived
  jobs: [Job!]! @derivedFrom(field: "template")
}
```

#### ProtocolStats (singleton)

```graphql
type ProtocolStats @entity {
  id: String!                       # "protocol"
  totalJobs: BigInt!
  totalSettled: BigInt!
  totalDisputed: BigInt!
  totalRefunded: BigInt!
  totalVolumeUSDC: BigInt!          # Cumulative USDC locked
  totalFeesCollected: BigInt!       # Cumulative protocol fees
  totalDisputeBonds: BigInt!
  totalTemplates: BigInt!
  activeArbitrators: BigInt!
}
```

#### DailyStats

```graphql
type DailyStats @entity {
  id: String!                       # date as "YYYY-MM-DD" or dayId
  date: Int!                        # timestamp / 86400
  jobsCreated: BigInt!
  jobsSettled: BigInt!
  jobsDisputed: BigInt!
  jobsRefunded: BigInt!
  volumeUSDC: BigInt!
  feesCollected: BigInt!
}
```

### Immutable Event Entities

All event entities use `@entity(immutable: true)` and `Bytes!` IDs constructed from `tx.hash.concatI32(logIndex)`.

Common fields on all event entities:
- `id: Bytes!`
- `blockNumber: BigInt!`
- `blockTimestamp: BigInt!`
- `transactionHash: Bytes!`
- `logIndex: BigInt!`

#### AegisEscrow Events (14)

| Entity | Key Fields |
|--------|------------|
| `JobCreatedEvent` | `jobId`, `clientAgentId`, `providerAgentId`, `amount`, `validatorAddress`, `deadline`, `job` |
| `JobFundedEvent` | `jobId`, `amount`, `job` |
| `DeliverableSubmittedEvent` | `jobId`, `deliverableURI`, `deliverableHash`, `validationRequestHash`, `job` |
| `ValidationReceivedEvent` | `jobId`, `score`, `passedThreshold`, `job` |
| `JobSettledEvent` | `jobId`, `providerWallet`, `providerAmount`, `protocolFee`, `job` |
| `JobRefundedEvent` | `jobId`, `clientAddress`, `amount`, `job` |
| `JobCancelledEvent` | `jobId`, `job` |
| `DisputeRaisedEvent` | `jobId`, `initiator`, `job` |
| `ClientConfirmedEvent` | `jobId`, `job` |
| `DisputeWindowStartedEvent` | `jobId`, `windowEnd`, `job` |
| `FeedbackSubmittedEvent` | `jobId`, `agentId`, `value`, `job` |
| `ProtocolFeeUpdatedEvent` | `oldFee`, `newFee` |
| `DisputeWindowUpdatedEvent` | `oldWindow`, `newWindow` |
| `TreasuryUpdatedEvent` | `oldTreasury`, `newTreasury` |

Note: `DisputeContractUpdated` and `AuthorizedCallerUpdated` are admin events, indexed as:

| Entity | Key Fields |
|--------|------------|
| `DisputeContractUpdatedEvent` | `oldDispute`, `newDispute` |
| `AuthorizedCallerUpdatedEvent` | `caller`, `authorized` |

#### AegisDispute Events (10)

| Entity | Key Fields |
|--------|------------|
| `DisputeInitiatedEvent` | `disputeId`, `jobId`, `initiator`, `dispute`, `job` |
| `EvidenceSubmittedEvent` | `disputeId`, `submitter`, `evidenceURI`, `dispute` |
| `ArbitratorAssignedEvent` | `disputeId`, `arbitrator`, `dispute` |
| `DisputeResolvedEvent` | `disputeId`, `jobId`, `clientPercent`, `method`, `dispute`, `job` |
| `ReValidationRequestedEvent` | `disputeId`, `newValidationHash`, `dispute` |
| `ArbitratorStakedEvent` | `arbitrator`, `amount` |
| `ArbitratorUnstakedEvent` | `arbitrator`, `amount` |
| `ArbitratorSlashedEvent` | `arbitrator`, `amount` |
| `BondReturnedEvent` | `disputeId`, `to`, `amount`, `dispute` |
| `BondForfeitedEvent` | `disputeId`, `from`, `amount`, `dispute` |

#### AegisTreasury Events (5)

| Entity | Key Fields |
|--------|------------|
| `FeeReceivedEvent` | `source`, `amount`, `treasuryShare`, `arbitratorShare` |
| `TreasuryWithdrawalEvent` | `to`, `amount` |
| `ArbitratorRewardsDistributedEvent` | `amount` |
| `SourceAuthorizedEvent` | `source`, `authorized` |
| `ArbitratorPoolBpsUpdatedEvent` | `oldBps`, `newBps` |

#### AegisJobFactory Events (4)

| Entity | Key Fields |
|--------|------------|
| `TemplateCreatedEvent` | `templateId`, `name`, `creator`, `defaultValidator`, `defaultTimeout`, `minValidation`, `template` |
| `TemplateUpdatedEvent` | `templateId`, `template` |
| `TemplateDeactivatedEvent` | `templateId`, `template` |
| `JobCreatedFromTemplateEvent` | `jobId`, `templateId`, `job`, `template` |

### Generic Event Interface

```graphql
interface JobEvent {
  id: Bytes!
  job: Job!
  blockNumber: BigInt!
  blockTimestamp: BigInt!
  transactionHash: Bytes!
}
```

All job-related event entities implement this interface for unified timeline queries.

---

## Mapping Handler Design

### Handler Pattern

Each handler follows the same structure:

1. **Create immutable event entity** — record the raw event data
2. **Update mutable aggregate entity** — mutate Job/Dispute/Arbitrator state
3. **Update ProtocolStats** — increment counters
4. **Update DailyStats** — increment daily counters

### Key Handler Logic

**`handleJobCreated`:** Create `Job` entity (state=FUNDED since createJob atomically funds), create `JobCreatedEvent`, increment `ProtocolStats.totalJobs` and `DailyStats.jobsCreated`, add to `totalVolumeUSDC`.

**`handleJobSettled`:** Update `Job.state` to SETTLED, set `providerAmount`/`protocolFee`/`settledAt`. Create `JobSettledEvent`. Increment `ProtocolStats.totalSettled` and `DailyStats.jobsSettled`. Add to `totalFeesCollected`.

**`handleDisputeInitiated`:** Create `Dispute` entity, update `Job.state` to DISPUTED. Create `DisputeInitiatedEvent`. Increment `ProtocolStats.totalDisputed`.

**`handleDisputeResolved`:** Update `Dispute` (resolved=true, method, clientPercent, resolvedAt). Update `Job.state` to RESOLVED. Create `DisputeResolvedEvent`.

**`handleArbitratorStaked`:** Create or load `Arbitrator` entity, add to `totalStaked`. Create `ArbitratorStakedEvent`. Update `ProtocolStats.activeArbitrators`.

**`handleFeeReceived`:** Create `FeeReceivedEvent`. Update `ProtocolStats.totalFeesCollected`.

### helpers.ts Utilities

- `getOrCreateProtocolStats()` — Load or initialize singleton
- `getOrCreateDailyStats(timestamp)` — Load or initialize day bucket
- `getOrCreateArbitrator(address)` — Load or initialize arbitrator
- `jobStateToString(stateInt)` — Map uint8 enum to human-readable string
- `resolutionToString(resolutionInt)` — Map uint8 enum to string
- `generateEventId(event)` — `event.transaction.hash.concatI32(event.logIndex.toI32())`

---

## Network Configuration

### config/base-sepolia.json

```json
{
  "network": "base-sepolia",
  "escrowAddress": "0xe988128467299fD856Bb45D2241811837BF35E77",
  "disputeAddress": "0x2c831D663B87194Fa6444df17A9A7d135186Cb41",
  "treasuryAddress": "0xE64D271a863aa1438FBb36Bd1F280FA1F499c3f5",
  "factoryAddress": "0xFD451BEfa1eE3EB4dBCA4E9EA539B4bf432866dA",
  "startBlock": 37617228
}
```

### config/base.json

```json
{
  "network": "base",
  "escrowAddress": "0x0000000000000000000000000000000000000000",
  "disputeAddress": "0x0000000000000000000000000000000000000000",
  "treasuryAddress": "0x0000000000000000000000000000000000000000",
  "factoryAddress": "0x0000000000000000000000000000000000000000",
  "startBlock": 0
}
```

---

## Build & Deploy

```bash
# Install dependencies
cd subgraph && npm install

# Generate types from schema + ABIs
npm run codegen

# Build (compiles AssemblyScript to WASM)
npm run build

# Run unit tests
npm run test

# Prepare for network and deploy
npm run prepare:base-sepolia
graph auth --studio <DEPLOY_KEY>
graph deploy --studio aegis-protocol
```

### package.json scripts

```json
{
  "scripts": {
    "codegen": "graph codegen",
    "build": "graph build",
    "test": "graph test",
    "prepare:base-sepolia": "mustache config/base-sepolia.json subgraph.template.yaml > subgraph.yaml",
    "prepare:base": "mustache config/base.json subgraph.template.yaml > subgraph.yaml",
    "deploy:studio": "graph deploy --studio aegis-protocol"
  }
}
```

---

## Testing Strategy

Unit tests with Matchstick framework covering:

1. **Event → Entity mapping correctness** — Each handler creates the right entities with correct field values
2. **State transitions** — Job state machine follows CREATED→FUNDED→DELIVERED→VALIDATING→SETTLED path
3. **Counter increments** — ProtocolStats and DailyStats counters update correctly
4. **Arbitrator lifecycle** — Stake/unstake/slash math is correct
5. **Edge cases** — Zero amounts, missing optional fields, re-entrant event patterns

---

## Example Queries

### Get all jobs for an agent

```graphql
{
  jobs(where: { clientAgentId: "1" }, orderBy: createdAt, orderDirection: desc) {
    id
    state
    amount
    providerAgentId
    createdAt
    deadline
  }
}
```

### Protocol dashboard stats

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

### Job timeline (all events)

```graphql
{
  job(id: "0x...") {
    id
    state
    amount
    events(orderBy: blockTimestamp) {
      __typename
      blockTimestamp
      transactionHash
    }
  }
}
```

### Daily volume chart

```graphql
{
  dailyStats(first: 30, orderBy: date, orderDirection: desc) {
    date
    jobsCreated
    jobsSettled
    volumeUSDC
    feesCollected
  }
}
```

---

## Metrics

| Metric | Target |
|--------|--------|
| Entities | 6 mutable + ~33 immutable event types |
| Event handlers | 33 total across 4 contracts |
| Matchstick tests | 40+ covering all handlers |
| Indexing from block | 37,617,228 (Base Sepolia deployment) |
| specVersion | 1.3.0 |
| apiVersion | 0.0.9 |
