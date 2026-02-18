# Web3 SDK Architecture Comparison (Quick Reference)

## At-a-Glance Comparison

| Feature | Uniswap | Aave | Safe | Across | Hyperlane | thirdweb | Alchemy | **AEGIS Target** |
|---------|---------|------|------|--------|-----------|----------|---------|------------------|
| **Package Structure** | Monorepo | Monorepo (archived) | Monorepo | Single + app-sdk | Monorepo | Monorepo | Single | **Monorepo** |
| **Monorepo Tool** | Yarn + Turbo | Yarn + Lerna | pnpm + Turbo | N/A | pnpm + Turbo | pnpm + Turbo + Biome | N/A | **pnpm + Turbo** |
| **Build Tool** | tsc | Rollup | tsc | TSDX | tsc | tsc + Biome | Rollup | **tsup** |
| **Primary Provider** | Agnostic | ethers v5 | ethers v5 | viem | ethers.js | Abstracted | ethers.js | **viem + ethers via adapters** |
| **Provider Abstraction** | None (pure compute) | Peer dependency | Adapter pattern | Peer dependency | MultiProvider | Adapter system | Wrapper/enhancement | **Adapter pattern** |
| **API Style** | Class-based (immutable) | Service classes | Static factory + class | Factory functions | Class-based + factories | Function-based (v5) | Namespaced client | **Hybrid (functions + client)** |
| **Type Generation** | Manual + sdk-core | ethers typings | Custom types | viem inference | Custom types | Auto ABI resolution | ethers + custom | **abitype (const ABIs)** |
| **TypeChain Used** | No | No (ethers v5 types) | No | No | No | No | No | **No (abitype)** |
| **viem Support** | Indirect | No | Requested (not native) | Native | No | Native (adapter) | No | **Native + ethers adapter** |
| **ethers Support** | Indirect | v5 only | Native (adapter) | Via conversion | Native | v5/v6 adapters | Native wrapper | **v6 (adapter)** |
| **Tree-Shakeable** | Yes | Partial | Partial | Yes | Partial | Yes (v5) | No | **Yes** |
| **Multi-Chain** | No (per-chain logic) | Per-deployment | Per-deployment | Multi-chain | **Multi-chain core** | Multi-chain | Multi-chain | **Per-deployment (Base L2)** |
| **Deployment Addresses** | Hardcoded defaults | User config | User config | User config | Environment presets | Auto-detect | User config | **Hardcoded + overrides** |
| **License** | MIT | MIT | MIT | MIT | Apache 2.0 | Apache 2.0 | MIT | **MIT** |
| **Status (2026)** | Active | Archived (→ aave-sdk) | Active | Active | Active | Active (v5) | Active | **Planning** |

---

## Package Organization Patterns

### Monorepo Structure Comparison

**Uniswap (Protocol-centric):**
```
sdks/
├── sdk-core/          # Shared primitives (Token, Currency)
├── v2-sdk/            # Uniswap V2
├── v3-sdk/            # Uniswap V3
├── v4-sdk/            # Uniswap V4
└── uniswapx-sdk/      # UniswapX
```

**Safe (Feature-centric):**
```
packages/
├── protocol-kit/      # Core Safe interactions
├── api-kit/           # Transaction service API
├── relay-kit/         # ERC-4337 relayer
└── types-kit/         # Shared types
```

**thirdweb (Service-centric):**
```
packages/
├── thirdweb/          # Unified SDK
├── adapters/          # viem, ethers, wagmi
├── engine/            # Backend service
├── vault/             # Key management
└── insight/           # Indexing service
```

**Hyperlane (Polyglot):**
```
typescript/
├── sdk/               # Core SDK
├── cli/               # CLI tool
└── infra/             # Infrastructure
solidity/              # Smart contracts
rust/                  # Agents
```

**AEGIS Target (Contract + Tools):**
```
packages/
├── types/             # @aegis/types - Shared TypeScript types
├── abis/              # @aegis/abis - Contract ABIs (const)
├── sdk/               # @aegis/sdk - Main TypeScript SDK
├── sdk-python/        # @aegis/python - Python SDK (future)
└── examples/          # Integration examples
```

---

## API Surface Comparison

### Initialization Patterns

| SDK | Pattern | Example |
|-----|---------|---------|
| **Uniswap** | Direct instantiation | `new Pool(tokenA, tokenB, fee, ...)` |
| **Aave** | Service constructors | `new UiPoolDataProvider({ provider, chainId })` |
| **Safe** | Static factory (async) | `await Safe.init({ provider, safeAddress })` |
| **Across** | Factory function | `createAcrossClient({ integratorId, chains })` |
| **Hyperlane** | Class + factories | `new MultiProvider(configs)`, `HyperlaneCore.fromEnvironment(...)` |
| **thirdweb** | Factory function | `createThirdwebClient({ clientId })` |
| **Alchemy** | Class constructor | `new Alchemy({ apiKey, network })` |
| **AEGIS Target** | **Hybrid** | `createAegisClient({ chain, provider })` + `createEscrow(provider, address)` |

### Method Organization

| SDK | Organization | Example |
|-----|--------------|---------|
| **Uniswap** | Immutable objects | `pool.token0`, `trade.route`, `route.pools` |
| **Aave** | Service methods | `poolService.getReserves()`, `incentiveService.getUserRewards()` |
| **Safe** | Instance methods | `safe.createTransaction()`, `safe.signMessage()` |
| **Across** | Client methods | `client.getQuote()`, `getSupportedChains(client)` |
| **Hyperlane** | Instance methods | `core.sendMessage()`, `multiProvider.getProvider()` |
| **thirdweb** | Function imports | `import { balanceOf } from 'thirdweb/extensions/erc20'` |
| **Alchemy** | Namespaced methods | `alchemy.core.getBalance()`, `alchemy.nft.getNfts()` |
| **AEGIS Target** | **Module functions** | `aegis.escrow.createJob()`, `createEscrow(...).createJob()` |

---

## Provider Abstraction Comparison

### Adapter Implementations

**Safe Protocol Kit (Adapter Pattern):**
```typescript
// User's ethers provider
const ethAdapter = new EthersAdapter({ ethers, signerOrProvider })

// SDK uses abstracted SafeProvider internally
const safe = await Safe.init({
  provider: ethAdapter,  // ← Adapter hides ethers details
  safeAddress: '0x...'
})
```

**thirdweb (Bidirectional Adapters):**
```typescript
import { viemAdapter, ethers6Adapter } from 'thirdweb/adapters'

// Viem → thirdweb
const thirdwebContract = viemAdapter.contract(viemContract)

// thirdweb → Viem
const viemClient = viemAdapter.client(thirdwebClient)

// Ethers → thirdweb
const thirdwebContract = ethers6Adapter.contract(ethersContract)
```

**Hyperlane (Multi-Provider Wrapper):**
```typescript
const multiProvider = new MultiProvider({
  ethereum: { provider: new ethers.JsonRpcProvider('...') },
  polygon: { provider: new ethers.JsonRpcProvider('...'), confirmations: 10 }
})

// SDK methods use multiProvider to get chain-specific provider
const core = new HyperlaneCore(multiProvider)
await core.sendMessage({ origin: 'ethereum', destination: 'polygon', ... })
```

**Aave (Direct Dependency):**
```typescript
// Requires ethers v5 as peer dependency
const provider = new ethers.providers.JsonRpcProvider('...')

const poolService = new UiPoolDataProvider({
  uiPoolDataProviderAddress: '0x...',
  provider,  // ← Direct ethers provider, no adapter
  chainId: 1
})
```

**AEGIS Target (Adapter Pattern):**
```typescript
import { ViemAdapter, EthersAdapter } from '@aegis/sdk/adapters'

// Option 1: Viem
const provider = new ViemAdapter(viemClient)

// Option 2: Ethers
const provider = new EthersAdapter(ethersProvider)

// SDK uses AegisProvider interface
const aegis = createAegisClient({ provider, contracts })
```

---

## Type Safety Approaches

### Type Generation Methods

| SDK | Method | Build Step | Runtime | Pros | Cons |
|-----|--------|-----------|---------|------|------|
| **Uniswap** | Manual types in sdk-core | No | Native TS | Full control, no deps | Manual maintenance |
| **Aave** | ethers v5 contract typings | Yes (compile) | ethers types | Standard ethers DX | Locked to ethers v5 |
| **Safe** | Custom TypeScript types | No | Native TS | Type-safe without codegen | Manual type definitions |
| **Across** | viem + abitype inference | No | Type inference | Zero build, modern | Requires const assertion |
| **Hyperlane** | Custom types + interfaces | No | Native TS | Flexible, no tooling | Manual type maintenance |
| **thirdweb** | Auto ABI resolution | Partial | Runtime ABI fetch | Zero config | Network dependency |
| **Alchemy** | ethers + custom classes | No | ethers + custom | Strong typing, intellisense | Manual type maintenance |
| **AEGIS** | **abitype (const ABIs)** | **Script-generated** | **Type inference** | **No TypeChain, modern, automated** | **Requires TS 4.7+** |

### Type Inference Example (abitype)

```typescript
// packages/abis/src/AegisEscrow.ts
export const AegisEscrowAbi = [
  {
    type: 'function',
    name: 'createJob',
    inputs: [
      { name: 'providerId', type: 'uint256' },
      { name: 'clientId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'validationThreshold', type: 'uint8' }
    ],
    outputs: [{ name: 'jobId', type: 'uint256' }],
    stateMutability: 'payable'
  },
  // ...
] as const  // ← Enables type inference

// TypeScript automatically infers:
// Function: 'createJob'
// Args: [providerId: bigint, clientId: bigint, amount: bigint, deadline: bigint, validationThreshold: number]
// Returns: bigint
// Payable: true

// Usage with viem
import { createPublicClient } from 'viem'
import { AegisEscrowAbi } from '@aegis/abis'

const jobId = await client.readContract({
  address: '0x...',
  abi: AegisEscrowAbi,
  functionName: 'createJob',  // ← Autocomplete!
  args: [1n, 2n, 1000000n, 1234567890n, 70],  // ← Typed!
  value: 2500n  // ← Knows it's payable
})
// jobId is typed as bigint
```

---

## Build Tool Performance Comparison

### Build Speed Benchmarks (Typical SDK)

| Tool | Initial Build | Rebuild (cached) | Watch Mode Latency | Bundle Size (ESM) |
|------|---------------|------------------|-------------------|-------------------|
| **tsc** | ~5-10s | ~3-5s | ~1-2s | N/A (no bundling) |
| **Rollup** | ~8-15s | ~4-8s | ~2-4s | Optimal (best tree-shaking) |
| **TSDX** | ~10-20s | ~5-10s | ~3-5s | Good (Rollup-based) |
| **tsup** | **~0.5-2s** | **~0.2-0.5s** | **~50-200ms** | Good (esbuild-based) |
| **Turborepo** | Orchestrator (parallelizes above) | **0s (cache hit)** | N/A | N/A |

**Key Takeaways:**
- **tsup** is 10-20x faster than Rollup/tsdx
- **Turborepo** cache = instant rebuilds for unchanged packages
- **Rollup** still best for maximum bundle optimization (library publishing)
- **tsc** alone = fast but no bundling (users bundle themselves)

### AEGIS Target Stack
- **Local dev:** tsup (fast iteration)
- **Publishing:** Consider Rollup pass for final optimization (optional)
- **Monorepo:** Turborepo for caching + parallel builds

---

## Multi-Contract Coordination Patterns

### How SDKs Handle Protocol Complexity

**Uniswap (Immutable Data Flow):**
```typescript
// No state, pure computation
const pool = new Pool(...)       // Pool state snapshot
const route = new Route([pool])  // Routing through pools
const trade = Trade.exactIn(route, amount)  // Quote

// User executes separately (SDK doesn't send txs)
```

**Aave (Service per Contract):**
```typescript
// Each contract = separate service
const pool = new UiPoolDataProvider({ provider, chainId })
const incentives = new UiIncentiveDataProvider({ provider, chainId })
const staking = new AaveStakingHelper({ provider, chainId })

// User coordinates
const reserves = await pool.getReserves()
const rewards = await incentives.getUserRewards(user)
```

**Safe (Unified with Internal Coordination):**
```typescript
// Single client coordinates internally
const safe = await Safe.init({ provider, safeAddress })

// Methods coordinate across contracts automatically
const tx = await safe.createTransaction({ transactions: [...] })
const signed = await safe.signTransaction(tx)
await safe.executeTransaction(signed)  // ← Handles Safe + MultiSend + modules
```

**Hyperlane (Multi-Chain Coordinator):**
```typescript
const multiProvider = new MultiProvider({ ethereum: ..., polygon: ... })
const core = new HyperlaneCore(multiProvider)

// Core coordinates across chains + contracts
await core.sendMessage({
  origin: 'ethereum',      // ← Uses ethereum provider
  destination: 'polygon',  // ← Uses polygon provider
  message: '...'
})
```

**AEGIS Target (Service Modules + Unified Option):**
```typescript
// Option 1: Individual services
import { createEscrow, createDispute } from '@aegis/sdk'
const escrow = createEscrow(provider, addresses.escrow)
const dispute = createDispute(provider, addresses.dispute)

await escrow.createJob(...)
await dispute.raiseDispute(...)

// Option 2: Unified client (coordinates internally)
import { createAegisClient } from '@aegis/sdk'
const aegis = createAegisClient({ chain: 'base', provider })

await aegis.escrow.createJob(...)  // ← Uses escrow contract
await aegis.dispute.raiseDispute(...)  // ← Uses dispute contract
```

---

## Deployment Address Management

### Hardcoded vs Config-based

| SDK | Strategy | Example |
|-----|----------|---------|
| **Uniswap** | Hardcoded with chain detection | `POOL_INIT_CODE_HASH` varies by chain, SDK detects from provider |
| **Aave** | User provides address | `new UiPoolDataProvider({ uiPoolDataProviderAddress: '0x...' })` |
| **Safe** | User provides address | `Safe.init({ safeAddress: '0x...' })` |
| **Across** | User config + defaults | `createAcrossClient({ chains })` uses defaults, override via config |
| **Hyperlane** | Environment presets | `HyperlaneCore.fromEnvironment('mainnet')` uses preset addresses |
| **thirdweb** | Auto-detection + override | Detects chain, uses known addresses, allows override |
| **Alchemy** | Network enum | `Network.ETH_MAINNET` → SDK knows all addresses |
| **AEGIS** | **Hardcoded + override** | `{ chain: 'base' }` uses defaults, `{ contracts: {...} }` overrides |

### AEGIS Address Management Pattern

```typescript
// packages/sdk/src/chains.ts
export const AEGIS_ADDRESSES = {
  base: {
    escrow: '0x...',
    dispute: '0x...',
    treasury: '0x...',
    factory: '0x...'
  },
  baseSepolia: {
    escrow: '0x...',
    dispute: '0x...',
    treasury: '0x...',
    factory: '0x...'
  }
} as const

// Usage 1: Use defaults
const aegis = createAegisClient({
  chain: 'base',  // ← Auto-loads AEGIS_ADDRESSES.base
  provider
})

// Usage 2: Override (for forks, custom deployments)
const aegis = createAegisClient({
  provider,
  contracts: {
    escrow: '0xCustomEscrow...',
    dispute: '0xCustomDispute...',
    treasury: '0xCustomTreasury...',
    factory: '0xCustomFactory...'
  }
})
```

---

## Key Decisions for AEGIS SDK

### ✅ Consensus Choices (Follow Industry Standard)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Monorepo tool** | pnpm + Turborepo | Fastest, best caching, 90%+ adoption in new projects |
| **Build tool** | tsup | 20x faster than Rollup, zero config, perfect for SDK |
| **Type generation** | abitype (const ABIs) | No build step, modern, TypeChain creator endorsement |
| **Provider abstraction** | Adapter pattern | Proven by Safe/thirdweb, supports viem + ethers |
| **Primary provider** | viem (with ethers adapter) | Modern, lighter, better types, industry trend |
| **Linter/formatter** | Biome or ESLint+Prettier | Biome 100x faster but less ecosystem support |

### ⚖️ Context-Dependent Choices (AEGIS-Specific)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **API style** | Hybrid (functions + client) | Functional for tree-shaking, client for DX (like thirdweb v5) |
| **Package structure** | Monorepo (types, abis, sdk, examples) | 4 contracts = protocol-level complexity, benefits from monorepo |
| **Address management** | Hardcoded + override | Best DX for Base deployment, flexibility for forks |
| **Multi-contract** | Service modules + unified client | Both individual service imports and convenient client wrapper |

### 🚀 Innovation Opportunities (Differentiate AEGIS)

| Feature | Approach | Why |
|---------|----------|-----|
| **ERC-8004 integration** | First-class SDK support for agent registries | No other SDK does this — our moat |
| **x402 payments** | HTTP-native USDC payment helpers | Simplify agent-to-agent payments |
| **Validation templates** | Pre-built validation logic for common job types | Reduce integration time |
| **Reputation queries** | Helper functions for ERC-8004 reputation data | Simplify agent selection |

---

## Next Steps

1. **Set up monorepo structure** (pnpm + Turborepo)
2. **Create ABI generation script** (Foundry JSON → const ABIs)
3. **Implement provider adapters** (ViemAdapter + EthersAdapter)
4. **Build core service modules** (escrow, dispute, treasury, factory)
5. **Create unified client wrapper** (convenience layer)
6. **Write integration examples** (viem, ethers, LangChain, AutoGPT)
7. **Generate TypeDoc documentation**
8. **Publish alpha to npm** (@aegis/sdk@0.1.0-alpha.1)

**Target timeline:** SDK Phase 2 (Weeks 9-12 per roadmap)
