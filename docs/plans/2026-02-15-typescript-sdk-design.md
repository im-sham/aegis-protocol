# AEGIS Protocol TypeScript SDK — Design Document

**Date:** 2026-02-15
**Author:** Shamim Rehman / Claude
**Status:** Approved
**Phase:** 4 (SDK & Developer Experience)

---

## 1. Purpose

Build a TypeScript SDK (`@aegis-protocol/sdk`) that lets AI agent frameworks and dapp developers interact with the AEGIS Protocol contracts on Base. The SDK wraps all 4 core contracts (Escrow, Dispute, Treasury, Factory) plus 3 ERC-8004 registries (Identity, Reputation, Validation) behind a type-safe, ergonomic API.

**Target users:**
- AI agent frameworks (AutoGPT, CrewAI, LangChain) — autonomous job creation, delivery, settlement
- Dapp developers — dashboards, job marketplaces, arbitrator panels

**Success criteria:**
- Full contract coverage (all public functions, events, errors typed)
- Works with both viem and ethers.js v6 via adapter pattern
- Tree-shakeable for bundle-sensitive consumers
- Published to npm as scoped packages

---

## 2. Industry Research

Analyzed 7 production Web3 SDKs: Uniswap, Aave, Safe, Across, Hyperlane, thirdweb, Alchemy.

### Consensus patterns (90%+ adoption)

| Decision | Standard | Evidence |
|----------|----------|----------|
| Monorepo | pnpm + Turborepo | Uniswap, Safe, Hyperlane, thirdweb all use this |
| Type generation | abitype (const ABIs) | wagmi/viem standard, replaced TypeChain |
| Primary provider | viem for new projects | 70%+ new SDKs default to viem |
| Multi-provider | Adapter pattern | Safe Protocol Kit, thirdweb proven in production |
| Build tool | tsup (esbuild-based) | 20x faster than Rollup, zero config |
| API style | Hybrid (unified client + tree-shakeable) | thirdweb v5, Across app-sdk |

---

## 3. Architecture

### 3.1 Package Structure (monorepo)

```
sdk/                                    # Monorepo root
├── packages/
│   ├── types/                          # @aegis-protocol/types
│   │   ├── src/
│   │   │   ├── index.ts               # Re-exports
│   │   │   ├── contracts.ts           # Job, Dispute, JobTemplate, ArbitratorStats
│   │   │   ├── enums.ts              # JobState, DisputeResolution
│   │   │   ├── errors.ts             # Typed custom errors (AegisError union)
│   │   │   └── config.ts             # ChainConfig, ClientOptions, addresses
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── abis/                           # @aegis-protocol/abis
│   │   ├── scripts/
│   │   │   └── generate.ts           # Foundry out/ → const ABI exports
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── AegisEscrow.ts        # export const aegisEscrowAbi = [...] as const
│   │   │   ├── AegisDispute.ts
│   │   │   ├── AegisTreasury.ts
│   │   │   ├── AegisJobFactory.ts
│   │   │   └── erc8004/
│   │   │       ├── Identity.ts
│   │   │       ├── Reputation.ts
│   │   │       └── Validation.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── sdk/                            # @aegis-protocol/sdk
│       ├── src/
│       │   ├── index.ts               # Public API exports
│       │   ├── client.ts             # AegisClient (unified entry point)
│       │   ├── provider.ts           # AegisProvider, ViemAdapter, EthersAdapter
│       │   ├── escrow.ts             # Escrow service module
│       │   ├── dispute.ts            # Dispute service module
│       │   ├── treasury.ts           # Treasury service module
│       │   ├── factory.ts            # Factory service module
│       │   ├── erc8004/
│       │   │   ├── identity.ts
│       │   │   ├── reputation.ts
│       │   │   └── validation.ts
│       │   └── utils/
│       │       ├── usdc.ts           # parseUSDC / formatUSDC
│       │       ├── addresses.ts      # Chain-specific deployed addresses
│       │       └── events.ts         # Event parsing helpers
│       ├── package.json
│       ├── tsconfig.json
│       └── tsup.config.ts            # ESM + CJS dual output
│
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
└── package.json                        # Root scripts
```

### 3.2 Why monorepo?

- **`@aegis-protocol/types`** — zero dependencies, importable by agent frameworks that only need type definitions
- **`@aegis-protocol/abis`** — auto-generated from Foundry, importable by anyone using viem directly without the full SDK
- **`@aegis-protocol/sdk`** — the main package, depends on types + abis

This matches Uniswap (sdk-core / v3-sdk), Safe (protocol-kit / types-kit), and Hyperlane (sdk / core).

---

## 4. Provider Abstraction

The SDK must work with both viem and ethers.js v6. We use an adapter pattern (proven by Safe Protocol Kit and thirdweb).

### 4.1 AegisProvider interface

```typescript
interface AegisProvider {
  // Read operations
  readContract<T>(params: ReadContractParams): Promise<T>;

  // Write operations (returns tx hash)
  writeContract(params: WriteContractParams): Promise<`0x${string}`>;

  // Wait for tx confirmation
  waitForTransaction(hash: `0x${string}`): Promise<TransactionReceipt>;

  // Event watching
  watchContractEvent(params: WatchEventParams): () => void;  // returns unsubscribe

  // Utilities
  getAddress(): Promise<`0x${string}`>;
  getChainId(): Promise<number>;
}
```

### 4.2 Factory methods

```typescript
// viem users
const aegis = AegisClient.fromViem({
  walletClient,     // for writes
  publicClient,     // for reads
  chain: "base-sepolia",
});

// ethers users
const aegis = AegisClient.fromEthers({
  signer,           // for writes
  provider,         // for reads (optional, derived from signer)
  chain: "base-sepolia",
});

// Read-only (no signer needed)
const aegis = AegisClient.readOnly({
  rpcUrl: "https://sepolia.base.org",
  chain: "base-sepolia",
});
```

---

## 5. API Surface

### 5.1 Unified client (primary API)

```typescript
const aegis = AegisClient.fromViem({ walletClient, publicClient, chain: "base-sepolia" });

// --- Escrow ---
const jobId = await aegis.escrow.createJob({
  clientAgentId: 1n,
  providerAgentId: 2n,
  jobSpecHash: "0x...",
  jobSpecURI: "ipfs://...",
  validatorAddress: "0x...",
  deadline: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
  amount: parseUSDC("10.00"),      // helper: "10.00" → 10000000n
  validationThreshold: 70,
});

await aegis.escrow.submitDeliverable(jobId, {
  deliverableURI: "ipfs://...",
  deliverableHash: "0x...",
});

await aegis.escrow.confirmDelivery(jobId);
await aegis.escrow.processValidation(jobId);
await aegis.escrow.settleAfterDisputeWindow(jobId);
await aegis.escrow.claimTimeout(jobId);

const job = await aegis.escrow.getJob(jobId);
const jobs = await aegis.escrow.getAgentJobs(agentId);
const stats = await aegis.escrow.getProtocolStats();

// --- Dispute ---
await aegis.dispute.stakeAsArbitrator(parseUSDC("1000"));
await aegis.dispute.unstakeArbitrator(parseUSDC("500"));
await aegis.dispute.assignArbitrator(disputeId);
await aegis.dispute.resolveByArbitrator(disputeId, {
  clientPercent: 70,
  rationaleURI: "ipfs://...",
  rationaleHash: "0x...",
});
await aegis.dispute.resolveByTimeout(disputeId);

const dispute = await aegis.dispute.getDispute(disputeId);
const arbitratorCount = await aegis.dispute.getActiveArbitratorCount();

// --- Factory ---
const templateId = await aegis.factory.createTemplate({
  name: "code-review",
  defaultValidator: "0x...",
  defaultTimeout: 7 * 24 * 3600,
  feeBps: 250,
  minValidation: 70,
  defaultDisputeSplit: 50,
});

const jobId = await aegis.factory.createJobFromTemplate({
  templateId,
  clientAgentId: 1n,
  providerAgentId: 2n,
  jobSpecHash: "0x...",
  jobSpecURI: "ipfs://...",
  amount: parseUSDC("50.00"),
});

// --- Treasury (admin) ---
const balance = await aegis.treasury.totalBalance();
await aegis.treasury.withdrawTreasury(recipientAddress, parseUSDC("100"));

// --- ERC-8004 Identity ---
const agentId = await aegis.identity.register("agent://my-agent");
const wallet = await aegis.identity.getAgentWallet(agentId);
const owner = await aegis.identity.ownerOf(agentId);

// --- ERC-8004 Reputation ---
const summary = await aegis.reputation.getSummary(agentId, clientAddresses);

// --- ERC-8004 Validation ---
const status = await aegis.validation.getValidationStatus(requestHash);

// --- Events ---
aegis.escrow.onJobCreated((event) => { ... });
aegis.escrow.onJobSettled((event) => { ... });
aegis.dispute.onDisputeResolved((event) => { ... });
```

### 5.2 Tree-shakeable imports (advanced)

```typescript
import { createJob, confirmDelivery, getJob } from "@aegis-protocol/sdk/escrow";
import { stakeAsArbitrator } from "@aegis-protocol/sdk/dispute";
import { parseUSDC, formatUSDC } from "@aegis-protocol/sdk/utils";
```

### 5.3 USDC helpers

```typescript
parseUSDC("10.50")    // → 10500000n
parseUSDC("0.01")     // → 10000n
formatUSDC(10500000n) // → "10.50"
formatUSDC(250000n)   // → "0.25"
```

---

## 6. Type System

### 6.1 Contract types (from AegisTypes.sol)

```typescript
// Enums
enum JobState {
  CREATED = 0, FUNDED = 1, DELIVERED = 2, VALIDATING = 3,
  DISPUTE_WINDOW = 4, SETTLED = 5, DISPUTED = 6, RESOLVED = 7,
  EXPIRED = 8, REFUNDED = 9, CANCELLED = 10
}

enum DisputeResolution {
  NONE = 0, RE_VALIDATION = 1, ARBITRATOR = 2,
  TIMEOUT_DEFAULT = 3, CLIENT_CONFIRM = 4
}

// Structs — mapped from Solidity with BigInt for uint256, number for uint8
interface Job { ... }       // 22 fields
interface Dispute { ... }   // 18 fields
interface JobTemplate { ... } // 8 fields
interface ArbitratorStats { ... } // 4 fields
```

### 6.2 Custom errors

All Solidity custom errors from AegisTypes.sol are typed and decoded:

```typescript
type AegisError =
  | { name: "JobNotFound"; args: { jobId: `0x${string}` } }
  | { name: "InvalidJobState"; args: { jobId: `0x${string}`; current: JobState; expected: JobState } }
  | { name: "NotJobParty"; args: { jobId: `0x${string}`; caller: `0x${string}` } }
  | { name: "InsufficientAmount"; args: { provided: bigint; required: bigint } }
  // ... all 25+ custom errors
```

SDK methods throw `AegisContractError` with the decoded error, not raw hex.

### 6.3 Event types

All events are typed and auto-decoded:

```typescript
interface JobCreatedEvent {
  jobId: `0x${string}`;
  clientAgentId: bigint;
  providerAgentId: bigint;
  amount: bigint;
  validatorAddress: `0x${string}`;
  deadline: bigint;
}
```

---

## 7. ABI Generation

Script extracts ABIs from Foundry's `out/` directory as `const` assertions for full abitype inference:

```typescript
// scripts/generate.ts
// Reads: ../../out/AegisEscrow.sol/AegisEscrow.json
// Writes: src/AegisEscrow.ts

export const aegisEscrowAbi = [
  {
    type: "function",
    name: "createJob",
    inputs: [ ... ],
    outputs: [{ name: "jobId", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
  // ...
] as const;
```

The `as const` assertion gives viem/abitype full type inference on function names, argument types, and return types.

---

## 8. Chain Configuration

```typescript
const CHAIN_CONFIGS = {
  "base-sepolia": {
    chainId: 84532,
    rpcUrl: "https://sepolia.base.org",
    contracts: {
      escrow: "0xe988128467299fD856Bb45D2241811837BF35E77",
      dispute: "0x2c831D663B87194Fa6444df17A9A7d135186Cb41",
      treasury: "0xE64D271a863aa1438FBb36Bd1F280FA1F499c3f5",
      factory: "0xFD451BEfa1eE3EB4dBCA4E9EA539B4bf432866dA",
      usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      identityRegistry: "0xc67ed2b93a4B05c35872fBB15c199Ee30ce4300D",
      reputationRegistry: "0x760b4605371faE6097AcD2dcd8ca93dd5FfF9c84",
      validationRegistry: "0xB9D5B30a207429E95ea7E055fbA6D9d6b7Ba632b",
    },
  },
  "base": {
    chainId: 8453,
    rpcUrl: "https://mainnet.base.org",
    contracts: {
      // TBD — populated on mainnet launch
    },
  },
} as const;
```

Users can also pass custom addresses for non-standard deployments.

---

## 9. Error Handling Strategy

1. **Contract reverts** — decoded into typed `AegisContractError` with human-readable message
2. **Provider errors** — wrapped in `AegisProviderError` (RPC failures, insufficient gas)
3. **Validation errors** — thrown before tx submission (wrong chain, invalid params, insufficient USDC balance)

```typescript
try {
  await aegis.escrow.createJob({ ... });
} catch (e) {
  if (e instanceof AegisContractError) {
    // e.name === "InsufficientAmount"
    // e.args === { provided: 500000n, required: 1000000n }
  }
  if (e instanceof AegisValidationError) {
    // e.message === "USDC balance insufficient: have 0.50, need 10.00"
  }
}
```

---

## 10. Build & Publish

### Tooling
- **pnpm** — package manager (workspaces)
- **Turborepo** — build orchestration
- **tsup** — build each package (ESM + CJS dual output)
- **vitest** — testing
- **TypeDoc** — API documentation generation

### Package outputs
```
dist/
├── index.mjs          # ESM
├── index.js           # CJS
├── index.d.ts         # Types
├── escrow.mjs         # Subpath export
├── escrow.js
├── escrow.d.ts
└── ...
```

### Peer dependencies
```json
{
  "peerDependencies": {
    "viem": "^2.0.0",
    "ethers": "^6.0.0"
  },
  "peerDependenciesMeta": {
    "viem": { "optional": true },
    "ethers": { "optional": true }
  }
}
```

One or the other required, not both.

---

## 11. Testing Strategy

- **Unit tests** — each service module tested against a local Foundry fork (anvil)
- **Integration tests** — full lifecycle against Base Sepolia testnet
- **Type tests** — verify TypeScript inference (tsd or expect-type)

---

## 12. Implementation Phases

### Phase 4a: Foundation (target: this session)
- Monorepo scaffolding (pnpm, turbo, tsconfig)
- ABI generation script
- Types package (all structs, enums, errors, config)
- Provider abstraction (viem + ethers adapters)

### Phase 4b: Core Services
- Escrow service module (highest value)
- Factory service module
- USDC helpers
- Event listeners

### Phase 4c: Full Coverage
- Dispute service module
- Treasury service module
- ERC-8004 registry wrappers
- Error decoding

### Phase 4d: Polish & Publish
- Unified AegisClient
- README + TypeDoc
- Vitest suite
- npm publish

---

## 13. Decisions Record

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo | pnpm + Turborepo | Industry standard (Uniswap, Safe, Hyperlane, thirdweb) |
| Provider lib | viem primary + ethers adapter | 70%+ new SDKs use viem; adapter covers ethers users |
| ABI approach | const assertions from Foundry | Full abitype inference, no TypeChain dependency |
| Build tool | tsup | 20x faster than Rollup, zero config ESM+CJS |
| API style | Unified client + tree-shakeable subpaths | Best of both worlds (thirdweb v5 pattern) |
| Test runner | vitest | Fast, viem-compatible, ESM-native |
| USDC helpers | parseUSDC/formatUSDC | Prevent 6-decimal footgun (most common DeFi SDK bug) |
