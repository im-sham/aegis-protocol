# AEGIS Protocol Subgraph — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build and deploy a subgraph to The Graph Subgraph Studio that indexes all 33 AEGIS-specific events across 4 contracts into a queryable GraphQL API on Base Sepolia.

**Architecture:** Standard Graph Protocol subgraph using AssemblyScript mappings. Mustache templates for multi-network support. Dual entity pattern: mutable aggregation entities (Job, Dispute, Arbitrator, ProtocolStats, DailyStats, JobTemplate) + immutable event entities for all 33 events. Bytes IDs for performance. @derivedFrom for all one-to-many relationships.

**Tech Stack:** AssemblyScript, @graphprotocol/graph-cli ^0.56.0, @graphprotocol/graph-ts ^0.31.0, matchstick-as ^0.6.0, mustache ^3.1.0

**Design Doc:** `docs/plans/2026-02-17-subgraph-design.md`

---

## Task 1: Scaffold Subgraph Project

**Files:**
- Create: `subgraph/package.json`
- Create: `subgraph/tsconfig.json`
- Create: `subgraph/.gitignore`
- Create: `subgraph/config/base-sepolia.json`
- Create: `subgraph/config/base.json`

**Step 1: Create `subgraph/package.json`**

```json
{
  "name": "@aegis-protocol/subgraph",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "codegen": "graph codegen",
    "build": "graph build",
    "test": "graph test",
    "prepare:base-sepolia": "mustache config/base-sepolia.json subgraph.template.yaml > subgraph.yaml",
    "prepare:base": "mustache config/base.json subgraph.template.yaml > subgraph.yaml",
    "deploy:studio": "graph deploy --studio aegis-protocol"
  },
  "dependencies": {
    "@graphprotocol/graph-cli": "^0.56.0",
    "@graphprotocol/graph-ts": "^0.31.0"
  },
  "devDependencies": {
    "matchstick-as": "^0.6.0",
    "mustache": "^3.1.0"
  }
}
```

**Step 2: Create `subgraph/tsconfig.json`**

```json
{
  "extends": "@graphprotocol/graph-ts/types/tsconfig.base.json",
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

**Step 3: Create `subgraph/.gitignore`**

```
node_modules/
build/
generated/
subgraph.yaml
```

Note: `subgraph.yaml` is generated from template, so gitignored.

**Step 4: Create `subgraph/config/base-sepolia.json`**

```json
{
  "network": "base-sepolia",
  "escrowAddress": "0xe988128467299fD856Bb45D2241811837BF35E77",
  "escrowStartBlock": 37617228,
  "disputeAddress": "0x2c831D663B87194Fa6444df17A9A7d135186Cb41",
  "disputeStartBlock": 37617228,
  "treasuryAddress": "0xE64D271a863aa1438FBb36Bd1F280FA1F499c3f5",
  "treasuryStartBlock": 37617228,
  "factoryAddress": "0xFD451BEfa1eE3EB4dBCA4E9EA539B4bf432866dA",
  "factoryStartBlock": 37617228
}
```

**Step 5: Create `subgraph/config/base.json`**

```json
{
  "network": "base",
  "escrowAddress": "0x0000000000000000000000000000000000000000",
  "escrowStartBlock": 0,
  "disputeAddress": "0x0000000000000000000000000000000000000000",
  "disputeStartBlock": 0,
  "treasuryAddress": "0x0000000000000000000000000000000000000000",
  "treasuryStartBlock": 0,
  "factoryAddress": "0x0000000000000000000000000000000000000000",
  "factoryStartBlock": 0
}
```

**Step 6: Extract ABIs from Foundry output**

Run this script to extract ABI arrays from Foundry's `out/` into subgraph-compatible JSON files:

```bash
cd /Users/shamimrehman/Projects/aegis-protocol
for contract in AegisEscrow AegisDispute AegisTreasury AegisJobFactory; do
  python3 -c "
import json
data = json.load(open('out/${contract}.sol/${contract}.json'))
json.dump(data['abi'], open('subgraph/abis/${contract}.json', 'w'), indent=2)
"
done
```

This creates 4 ABI files in `subgraph/abis/` containing only the ABI array (not the full Foundry artifact).

**Step 7: Install dependencies and verify**

```bash
cd subgraph && npm install
```

**Step 8: Commit**

```bash
git add subgraph/
git commit -m "feat(subgraph): scaffold project with configs and ABIs"
```

---

## Task 2: Schema — Mutable Entities + Subgraph Template

**Files:**
- Create: `subgraph/schema.graphql`
- Create: `subgraph/subgraph.template.yaml`

**Step 1: Create `subgraph/schema.graphql` with mutable entities**

Write the 6 mutable entities: `Job`, `Dispute`, `Arbitrator`, `JobTemplate`, `ProtocolStats`, `DailyStats`.

Key schema patterns:
- `Job.id: Bytes!` — the bytes32 jobId from contract
- `Dispute.job: Job!` — foreign key to Job
- `Job.dispute: [Dispute!]! @derivedFrom(field: "job")` — reverse lookup, no array storage
- `ProtocolStats.id: String!` — singleton with id "protocol"
- `DailyStats.id: String!` — day bucket with id = dayNumber as string
- `JobTemplate.id: String!` — templateId as string

All mutable entities use `@entity` (without `immutable: true`).

Refer to design doc `docs/plans/2026-02-17-subgraph-design.md` section "Entity Schema" for complete field definitions.

**Step 2: Add immutable event entities to schema**

Add all 33 event entities with `@entity(immutable: true)`. Each has:
- `id: Bytes!` — `tx.hash.concatI32(logIndex)`
- `blockNumber: BigInt!`
- `blockTimestamp: BigInt!`
- `transactionHash: Bytes!`
- `logIndex: BigInt!`
- Event-specific fields
- `job: Job` link where applicable (nullable for non-job events)
- `dispute: Dispute` link where applicable

Event entities to create (33 total):

**AegisEscrow (16):** `JobCreatedEvent`, `JobFundedEvent`, `DeliverableSubmittedEvent`, `ValidationReceivedEvent`, `JobSettledEvent`, `JobRefundedEvent`, `JobCancelledEvent`, `DisputeRaisedEvent`, `ClientConfirmedEvent`, `DisputeWindowStartedEvent`, `FeedbackSubmittedEvent`, `ProtocolFeeUpdatedEvent`, `DisputeWindowUpdatedEvent`, `TreasuryUpdatedEvent`, `DisputeContractUpdatedEvent`, `AuthorizedCallerUpdatedEvent`

**AegisDispute (10):** `DisputeInitiatedEvent`, `EvidenceSubmittedEvent`, `ArbitratorAssignedEvent`, `DisputeResolvedEvent`, `ReValidationRequestedEvent`, `ArbitratorStakedEvent`, `ArbitratorUnstakedEvent`, `ArbitratorSlashedEvent`, `BondReturnedEvent`, `BondForfeitedEvent`

**AegisTreasury (5):** `FeeReceivedEvent`, `TreasuryWithdrawalEvent`, `ArbitratorRewardsDistributedEvent`, `SourceAuthorizedEvent`, `ArbitratorPoolBpsUpdatedEvent`

**AegisJobFactory (4 — skip OwnershipTransferred):** `TemplateCreatedEvent`, `TemplateUpdatedEvent`, `TemplateDeactivatedEvent`, `JobCreatedFromTemplateEvent`

Note: Skip `OwnershipTransferred`, `Paused`, `Unpaused` (inherited OpenZeppelin events — not AEGIS-specific).

**Step 3: Create `subgraph/subgraph.template.yaml`**

Manifest uses Mustache `{{variables}}` for network-specific values. specVersion `1.3.0`, apiVersion `0.0.9`.

4 dataSources: AegisEscrow, AegisDispute, AegisTreasury, AegisJobFactory. Each lists:
- `network: {{network}}`
- `source.address: '{{escrowAddress}}'` (etc.)
- `source.startBlock: {{escrowStartBlock}}` (etc.)
- `source.abi: AegisEscrow` (etc.)
- All eventHandlers with full Solidity event signatures → handler function names

Include `indexerHints: prune: auto` at top level.

Event signatures must match exactly what the contract emits. Reference the grep output:

AegisEscrow events:
- `JobCreated(bytes32,uint256,uint256,uint256,address,uint256)` → `handleJobCreated`
- `JobFunded(bytes32,uint256)` → `handleJobFunded`
- `DeliverableSubmitted(bytes32,string,bytes32,bytes32)` → `handleDeliverableSubmitted`
- `ValidationReceived(bytes32,uint8,bool)` → `handleValidationReceived`
- `JobSettled(bytes32,address,uint256,uint256)` → `handleJobSettled`
- `JobRefunded(bytes32,address,uint256)` → `handleJobRefunded`
- `JobCancelled(bytes32)` → `handleJobCancelled`
- `DisputeRaised(bytes32,address)` → `handleDisputeRaised`
- `ClientConfirmed(bytes32)` → `handleClientConfirmed`
- `DisputeWindowStarted(bytes32,uint256)` → `handleDisputeWindowStarted`
- `FeedbackSubmitted(bytes32,uint256,int128)` → `handleFeedbackSubmitted`
- `ProtocolFeeUpdated(uint256,uint256)` → `handleProtocolFeeUpdated`
- `DisputeWindowUpdated(uint256,uint256)` → `handleDisputeWindowUpdated`
- `TreasuryUpdated(address,address)` → `handleTreasuryUpdated`
- `DisputeContractUpdated(address,address)` → `handleDisputeContractUpdated`
- `AuthorizedCallerUpdated(address,bool)` → `handleAuthorizedCallerUpdated`

AegisDispute events:
- `DisputeInitiated(bytes32,bytes32,address)` → `handleDisputeInitiated`
- `EvidenceSubmitted(bytes32,address,string)` → `handleEvidenceSubmitted`
- `ArbitratorAssigned(bytes32,address)` → `handleArbitratorAssigned`
- `DisputeResolved(bytes32,bytes32,uint8,uint8)` → `handleDisputeResolved`
- `ReValidationRequested(bytes32,bytes32)` → `handleReValidationRequested`
- `ArbitratorStaked(address,uint256)` → `handleArbitratorStaked`
- `ArbitratorUnstaked(address,uint256)` → `handleArbitratorUnstaked`
- `ArbitratorSlashed(address,uint256)` → `handleArbitratorSlashed`
- `BondReturned(bytes32,address,uint256)` → `handleBondReturned`
- `BondForfeited(bytes32,address,uint256)` → `handleBondForfeited`

AegisTreasury events:
- `FeeReceived(address,uint256,uint256,uint256)` → `handleFeeReceived`
- `TreasuryWithdrawal(address,uint256)` → `handleTreasuryWithdrawal`
- `ArbitratorRewardsDistributed(uint256)` → `handleArbitratorRewardsDistributed`
- `SourceAuthorized(address,bool)` → `handleSourceAuthorized`
- `ArbitratorPoolBpsUpdated(uint256,uint256)` → `handleArbitratorPoolBpsUpdated`

AegisJobFactory events:
- `TemplateCreated(uint256,string,address,address,uint256,uint8)` → `handleTemplateCreated`
- `TemplateUpdated(uint256)` → `handleTemplateUpdated`
- `TemplateDeactivated(uint256)` → `handleTemplateDeactivated`
- `JobCreatedFromTemplate(bytes32,uint256)` → `handleJobCreatedFromTemplate`

Note on `DisputeResolved`: The 4th parameter is `AegisTypes.DisputeResolution` which is an enum — in the ABI this is `uint8`. The event signature in the ABI will use `uint8`, not the enum name.

**Step 4: Generate types and verify build**

```bash
cd subgraph
npm run prepare:base-sepolia
npm run codegen
npm run build
```

Build will fail because mapping files don't exist yet — that's expected. But codegen should succeed, generating TypeScript types for all entities and events.

**Step 5: Commit**

```bash
git add subgraph/schema.graphql subgraph/subgraph.template.yaml
git commit -m "feat(subgraph): add schema and manifest template"
```

---

## Task 3: Helpers Module

**Files:**
- Create: `subgraph/src/helpers.ts`

**Step 1: Write `subgraph/src/helpers.ts`**

Utility functions used by all mapping handlers:

```typescript
import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { ProtocolStats, DailyStats, Arbitrator } from "../generated/schema";

// === ID Generation ===

export function generateEventId(event: ethereum.Event): Bytes {
  return event.transaction.hash.concatI32(event.logIndex.toI32());
}

// === Singleton/Aggregation Loaders ===

export function getOrCreateProtocolStats(): ProtocolStats {
  let stats = ProtocolStats.load("protocol");
  if (stats == null) {
    stats = new ProtocolStats("protocol");
    stats.totalJobs = BigInt.zero();
    stats.totalSettled = BigInt.zero();
    stats.totalDisputed = BigInt.zero();
    stats.totalRefunded = BigInt.zero();
    stats.totalVolumeUSDC = BigInt.zero();
    stats.totalFeesCollected = BigInt.zero();
    stats.totalDisputeBonds = BigInt.zero();
    stats.totalTemplates = BigInt.zero();
    stats.activeArbitrators = BigInt.zero();
    stats.save();
  }
  return stats;
}

export function getOrCreateDailyStats(timestamp: BigInt): DailyStats {
  let dayId = timestamp.toI32() / 86400;
  let id = dayId.toString();
  let stats = DailyStats.load(id);
  if (stats == null) {
    stats = new DailyStats(id);
    stats.date = dayId;
    stats.jobsCreated = BigInt.zero();
    stats.jobsSettled = BigInt.zero();
    stats.jobsDisputed = BigInt.zero();
    stats.jobsRefunded = BigInt.zero();
    stats.volumeUSDC = BigInt.zero();
    stats.feesCollected = BigInt.zero();
    stats.save();
  }
  return stats;
}

export function getOrCreateArbitrator(address: Bytes): Arbitrator {
  let arb = Arbitrator.load(address);
  if (arb == null) {
    arb = new Arbitrator(address);
    arb.totalStaked = BigInt.zero();
    arb.totalSlashed = BigInt.zero();
    arb.disputesAssigned = BigInt.zero();
    arb.disputesResolved = BigInt.zero();
    arb.firstStakedAt = BigInt.zero();
    arb.lastActivityAt = BigInt.zero();
    arb.save();
  }
  return arb;
}

// === Enum Converters ===

export function jobStateToString(state: i32): string {
  switch (state) {
    case 0: return "CREATED";
    case 1: return "FUNDED";
    case 2: return "DELIVERED";
    case 3: return "VALIDATING";
    case 4: return "DISPUTE_WINDOW";
    case 5: return "SETTLED";
    case 6: return "DISPUTED";
    case 7: return "RESOLVED";
    case 8: return "EXPIRED";
    case 9: return "REFUNDED";
    case 10: return "CANCELLED";
    default: return "UNKNOWN";
  }
}

export function resolutionToString(resolution: i32): string {
  switch (resolution) {
    case 0: return "NONE";
    case 1: return "RE_VALIDATION";
    case 2: return "ARBITRATOR";
    case 3: return "TIMEOUT_DEFAULT";
    case 4: return "CLIENT_CONFIRM";
    default: return "UNKNOWN";
  }
}
```

**Step 2: Commit**

```bash
git add subgraph/src/helpers.ts
git commit -m "feat(subgraph): add helper utilities for ID gen, stats, enums"
```

---

## Task 4: Escrow Mapping Handlers

**Files:**
- Create: `subgraph/src/escrow.ts`

**Step 1: Write `subgraph/src/escrow.ts`**

16 event handlers for AegisEscrow. Each handler:
1. Creates an immutable event entity
2. Updates the mutable Job entity (if job-related)
3. Updates ProtocolStats + DailyStats

Key handlers and their logic:

**`handleJobCreated`**: Create `Job` entity with state="FUNDED" (atomic funding). Create `JobCreatedEvent`. Increment `ProtocolStats.totalJobs`, `DailyStats.jobsCreated`, add to `totalVolumeUSDC`.

**`handleDeliverableSubmitted`**: Load Job, update state to "DELIVERED", set deliverableHash/URI/validationRequestHash. Create event entity.

**`handleValidationReceived`**: Load Job, set validationScore and passedThreshold. If passed → state="VALIDATING". Create event entity.

**`handleJobSettled`**: Load Job, update state to "SETTLED", set providerAmount/protocolFee/settledAt. Create event entity. Increment `ProtocolStats.totalSettled`, `DailyStats.jobsSettled`. Add protocolFee to `totalFeesCollected`.

**`handleDisputeRaised`**: Load Job, update state to "DISPUTED". Create event entity. Increment `ProtocolStats.totalDisputed`, `DailyStats.jobsDisputed`.

**`handleJobRefunded`**: Load Job, update state to "REFUNDED", set refundAmount. Create event entity. Increment counters.

**`handleClientConfirmed`**: Load Job, set resolution to "CLIENT_CONFIRM". Create event entity.

**`handleDisputeWindowStarted`**: Load Job, update state to "DISPUTE_WINDOW", set disputeWindowEnd. Create event entity.

**Admin handlers** (`handleProtocolFeeUpdated`, `handleDisputeWindowUpdated`, `handleTreasuryUpdated`, `handleDisputeContractUpdated`, `handleAuthorizedCallerUpdated`): Only create immutable event entities — no aggregate updates needed.

Import events from `../generated/AegisEscrow/AegisEscrow` (auto-generated by codegen from ABI).

**Step 2: Verify codegen + build compiles**

```bash
cd subgraph
npm run prepare:base-sepolia && npm run codegen && npm run build
```

Expected: Build may still fail if other mapping files are missing. That's OK — verify escrow.ts compiles by checking build output for errors in `src/escrow.ts` specifically.

**Step 3: Commit**

```bash
git add subgraph/src/escrow.ts
git commit -m "feat(subgraph): add AegisEscrow event handlers (16 events)"
```

---

## Task 5: Dispute Mapping Handlers

**Files:**
- Create: `subgraph/src/dispute.ts`

**Step 1: Write `subgraph/src/dispute.ts`**

10 event handlers for AegisDispute.

**`handleDisputeInitiated`**: Create `Dispute` entity (resolved=false). Create event entity. Load and update Job state if needed.

**`handleEvidenceSubmitted`**: Create event entity with dispute link. No Dispute entity mutation needed (evidence is tracked via derived events).

**`handleArbitratorAssigned`**: Load Dispute, set arbitrator. Load Arbitrator, increment disputesAssigned. Create event entity.

**`handleDisputeResolved`**: Load Dispute, set resolved=true, method (use `resolutionToString`), clientPercent, resolvedAt. Load Job, update state to "RESOLVED". Load Arbitrator if method=ARBITRATOR, increment disputesResolved. Create event entity.

**`handleReValidationRequested`**: Create event entity linked to dispute.

**`handleArbitratorStaked`**: Load/create Arbitrator, add to totalStaked, set firstStakedAt if zero. Increment `ProtocolStats.activeArbitrators` (only on first stake). Create event entity.

**`handleArbitratorUnstaked`**: Load Arbitrator, subtract from totalStaked. Create event entity. If totalStaked reaches zero, decrement `ProtocolStats.activeArbitrators`.

**`handleArbitratorSlashed`**: Load Arbitrator, add to totalSlashed, subtract from totalStaked. Create event entity.

**`handleBondReturned`/`handleBondForfeited`**: Create event entities linked to dispute.

**Step 2: Commit**

```bash
git add subgraph/src/dispute.ts
git commit -m "feat(subgraph): add AegisDispute event handlers (10 events)"
```

---

## Task 6: Treasury + Factory Mapping Handlers

**Files:**
- Create: `subgraph/src/treasury.ts`
- Create: `subgraph/src/factory.ts`

**Step 1: Write `subgraph/src/treasury.ts`**

5 event handlers. Simpler — mostly just create immutable event entities.

**`handleFeeReceived`**: Create event entity. Update `ProtocolStats.totalFeesCollected` (add amount). Update `DailyStats.feesCollected`.

**`handleTreasuryWithdrawal`**: Create event entity only.

**`handleArbitratorRewardsDistributed`**: Create event entity only.

**`handleSourceAuthorized`**: Create event entity only.

**`handleArbitratorPoolBpsUpdated`**: Create event entity only.

**Step 2: Write `subgraph/src/factory.ts`**

4 event handlers.

**`handleTemplateCreated`**: Create `JobTemplate` entity with all fields from event. Set active=true, jobCount=0. Create event entity. Increment `ProtocolStats.totalTemplates`.

**`handleTemplateUpdated`**: Load JobTemplate (the event only has templateId — limited info). Create event entity.

**`handleTemplateDeactivated`**: Load JobTemplate, set active=false. Create event entity.

**`handleJobCreatedFromTemplate`**: Load JobTemplate, increment jobCount. Load Job (should already exist from JobCreated event), set template link. Create event entity.

**Step 3: Verify full build**

```bash
cd subgraph
npm run prepare:base-sepolia && npm run codegen && npm run build
```

Expected: Full build should now succeed with all 4 mapping files present.

**Step 4: Commit**

```bash
git add subgraph/src/treasury.ts subgraph/src/factory.ts
git commit -m "feat(subgraph): add Treasury + Factory event handlers (9 events)"
```

---

## Task 7: Matchstick Unit Tests — Escrow

**Files:**
- Create: `subgraph/tests/escrow.test.ts`

**Step 1: Write escrow tests**

Test the core job lifecycle handlers using Matchstick. At minimum test:

1. `handleJobCreated` — creates Job entity with correct fields, creates JobCreatedEvent, increments ProtocolStats
2. `handleDeliverableSubmitted` — updates Job state to DELIVERED, sets deliverable fields
3. `handleValidationReceived` — updates Job validation score and passedThreshold
4. `handleJobSettled` — updates Job to SETTLED, sets amounts, increments stats
5. `handleJobRefunded` — updates Job to REFUNDED, sets refund amount
6. `handleDisputeRaised` — updates Job to DISPUTED
7. `handleClientConfirmed` — sets resolution to CLIENT_CONFIRM
8. `handleDisputeWindowStarted` — updates Job state and window end
9. Full lifecycle: Created → Delivered → Validated → Settled (chain of handlers)
10. Admin event creates immutable entity without affecting Job

Use Matchstick's `createMockedEvent()`, `newMockEvent()`, and `assert.fieldEquals()` patterns.

Reference: `@graphprotocol/graph-ts` test utilities from matchstick-as.

**Step 2: Run tests**

```bash
cd subgraph && npm run test
```

Expected: All escrow tests pass.

**Step 3: Commit**

```bash
git add subgraph/tests/escrow.test.ts
git commit -m "test(subgraph): add Matchstick tests for escrow handlers"
```

---

## Task 8: Matchstick Unit Tests — Dispute, Treasury, Factory

**Files:**
- Create: `subgraph/tests/dispute.test.ts`
- Create: `subgraph/tests/treasury.test.ts`
- Create: `subgraph/tests/factory.test.ts`

**Step 1: Write dispute tests**

At minimum:
1. `handleDisputeInitiated` — creates Dispute entity, links to Job
2. `handleArbitratorAssigned` — sets arbitrator on Dispute
3. `handleDisputeResolved` — marks resolved, sets method/clientPercent, updates Job to RESOLVED
4. `handleArbitratorStaked` — creates/updates Arbitrator entity, increments stats
5. `handleArbitratorSlashed` — subtracts from staked, adds to slashed
6. Full dispute lifecycle: Initiated → Evidence → Arbitrator Assigned → Resolved

**Step 2: Write treasury tests**

At minimum:
1. `handleFeeReceived` — creates event entity, updates ProtocolStats.totalFeesCollected
2. `handleTreasuryWithdrawal` — creates event entity only

**Step 3: Write factory tests**

At minimum:
1. `handleTemplateCreated` — creates JobTemplate entity with correct fields
2. `handleTemplateDeactivated` — sets active=false
3. `handleJobCreatedFromTemplate` — increments template jobCount

**Step 4: Run all tests**

```bash
cd subgraph && npm run test
```

Expected: All tests pass (40+ total across all files).

**Step 5: Commit**

```bash
git add subgraph/tests/
git commit -m "test(subgraph): add Matchstick tests for dispute, treasury, factory"
```

---

## Task 9: Full Build Verification + CI Integration

**Files:**
- Modify: `.github/workflows/test.yml` — add subgraph build step

**Step 1: Run complete build pipeline**

```bash
cd subgraph
npm run prepare:base-sepolia
npm run codegen
npm run build
npm run test
```

All should pass. Verify build output in `subgraph/build/` contains WASM files.

**Step 2: Add subgraph to CI**

Add a new job to `.github/workflows/test.yml` that runs the subgraph build and tests:

```yaml
  subgraph:
    name: Subgraph
    runs-on: ubuntu-latest
    permissions:
      contents: read
    defaults:
      run:
        working-directory: subgraph
    steps:
      - uses: actions/checkout@v5
        with:
          persist-credentials: false
          submodules: recursive

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Prepare manifest
        run: npm run prepare:base-sepolia

      - name: Generate types
        run: npm run codegen

      - name: Build subgraph
        run: npm run build

      - name: Run tests
        run: npm run test
```

**Step 3: Verify CI config is valid YAML**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/test.yml'))"
```

**Step 4: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: add subgraph build and test job"
```

---

## Task 10: Deploy to Subgraph Studio

**Note:** This task requires manual steps (Subgraph Studio account, deploy key). The implementer should:

1. Go to https://thegraph.com/studio/ and create a new subgraph named `aegis-protocol`
2. Copy the deploy key
3. Run:

```bash
cd subgraph
npm run prepare:base-sepolia
graph auth --studio <DEPLOY_KEY>
graph deploy --studio aegis-protocol --version-label v0.1.0
```

4. Verify the subgraph syncs and indexes from block 37617228
5. Test example queries in the Studio playground

This task is manual and cannot be fully automated. The implementer should create a `subgraph/README.md` documenting the deploy process.

**Files:**
- Create: `subgraph/README.md`

**Step 1: Write README with deploy instructions**

**Step 2: Commit**

```bash
git add subgraph/README.md
git commit -m "docs(subgraph): add README with build and deploy instructions"
```

---

## Verification

1. `cd subgraph && npm run prepare:base-sepolia` — generates subgraph.yaml from template
2. `npm run codegen` — generates TypeScript types from schema + ABIs
3. `npm run build` — compiles AssemblyScript to WASM (zero errors)
4. `npm run test` — all Matchstick tests pass (40+)
5. CI passes on push (both Foundry + Subgraph jobs green)
6. Subgraph deployed to Studio, syncing from block 37617228
7. Example GraphQL queries return expected results in Studio playground

## Critical Files Reference

| File | Purpose |
|------|---------|
| `subgraph/schema.graphql` | All entity definitions (6 mutable + 33 immutable) |
| `subgraph/subgraph.template.yaml` | Mustache manifest template |
| `subgraph/config/base-sepolia.json` | Testnet addresses + start block |
| `subgraph/src/helpers.ts` | Shared utilities |
| `subgraph/src/escrow.ts` | 16 AegisEscrow event handlers |
| `subgraph/src/dispute.ts` | 10 AegisDispute event handlers |
| `subgraph/src/treasury.ts` | 5 AegisTreasury event handlers |
| `subgraph/src/factory.ts` | 4 AegisJobFactory event handlers |
| `subgraph/tests/*.test.ts` | Matchstick unit tests |
| `.github/workflows/test.yml` | CI with subgraph build job |
| `docs/plans/2026-02-17-subgraph-design.md` | Design document |
| `out/AegisEscrow.sol/AegisEscrow.json` | Source ABI (Foundry artifact) |
