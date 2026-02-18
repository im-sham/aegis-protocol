# AEGIS SDK Code Examples (Based on Industry Best Practices)

**Based on research of:** Uniswap, Aave, Safe, Across, Hyperlane, thirdweb, Alchemy SDKs

---

## 1. Project Structure

```
aegis-protocol/
├── contracts/                 # Foundry project (existing)
│   ├── src/
│   │   ├── AegisEscrow.sol
│   │   ├── AegisDispute.sol
│   │   ├── AegisTreasury.sol
│   │   └── AegisJobFactory.sol
│   └── out/                   # Foundry build artifacts
│
├── packages/                  # SDK monorepo
│   ├── types/                 # @aegis/types
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── jobs.ts
│   │   │   ├── disputes.ts
│   │   │   └── config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── abis/                  # @aegis/abis
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── AegisEscrow.ts
│   │   │   ├── AegisDispute.ts
│   │   │   ├── AegisTreasury.ts
│   │   │   └── AegisJobFactory.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── sdk/                   # @aegis/sdk
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── client.ts
│   │   │   ├── adapters/
│   │   │   │   ├── base.ts
│   │   │   │   ├── viem.ts
│   │   │   │   └── ethers.ts
│   │   │   ├── escrow/
│   │   │   │   ├── index.ts
│   │   │   │   └── types.ts
│   │   │   ├── dispute/
│   │   │   │   ├── index.ts
│   │   │   │   └── types.ts
│   │   │   ├── treasury/
│   │   │   │   └── index.ts
│   │   │   ├── factory/
│   │   │   │   └── index.ts
│   │   │   ├── chains.ts
│   │   │   └── utils/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── examples/              # Integration examples
│       ├── viem-example/
│       ├── ethers-example/
│       └── langchain-agent/
│
├── scripts/
│   └── generate-abis.ts       # Foundry JSON → const ABIs
│
├── package.json               # Root package.json (workspace)
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.json              # Root tsconfig
```

---

## 2. Configuration Files

### Root `package.json`

```json
{
  "name": "aegis-protocol",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "generate:abis": "tsx scripts/generate-abis.ts",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.8.0",
    "tsup": "^8.0.0",
    "turbo": "^2.0.0",
    "typescript": "^5.5.0",
    "tsx": "^4.7.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'packages/*'
```

### `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "outputs": [],
      "cache": false
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "cache": false
    },
    "clean": {
      "cache": false
    }
  }
}
```

---

## 3. ABI Generation Script

### `scripts/generate-abis.ts`

```typescript
#!/usr/bin/env tsx
import fs from 'fs'
import path from 'path'

const CONTRACTS = [
  'AegisEscrow',
  'AegisDispute',
  'AegisTreasury',
  'AegisJobFactory'
]

const OUT_DIR = path.join(__dirname, '../contracts/out')
const ABIS_DIR = path.join(__dirname, '../packages/abis/src')

console.log('🔧 Generating ABIs from Foundry artifacts...\n')

for (const contract of CONTRACTS) {
  const artifactPath = path.join(OUT_DIR, `${contract}.sol`, `${contract}.json`)

  if (!fs.existsSync(artifactPath)) {
    console.error(`❌ Artifact not found: ${artifactPath}`)
    console.error('   Run `forge build` first!')
    process.exit(1)
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'))

  const code = `// Auto-generated from Foundry artifact
// Do not edit manually

export const ${contract}Abi = ${JSON.stringify(artifact.abi, null, 2)} as const

export const ${contract}Bytecode = '${artifact.bytecode.object}' as const
`

  fs.writeFileSync(path.join(ABIS_DIR, `${contract}.ts`), code)
  console.log(`✅ Generated ${contract}.ts`)
}

// Generate index.ts
const indexCode = `// Auto-generated ABI exports
// Do not edit manually

${CONTRACTS.map(c => `export { ${c}Abi, ${c}Bytecode } from './${c}'`).join('\n')}
`

fs.writeFileSync(path.join(ABIS_DIR, 'index.ts'), indexCode)
console.log(`✅ Generated index.ts\n`)
console.log('🎉 ABI generation complete!')
```

**Usage:**
```bash
forge build                    # Build contracts
pnpm generate:abis            # Generate ABIs
```

---

## 4. Types Package

### `packages/types/src/index.ts`

```typescript
export * from './jobs'
export * from './disputes'
export * from './config'
export * from './events'
```

### `packages/types/src/jobs.ts`

```typescript
import type { Address, Hash } from 'viem'

export type JobStatus =
  | 'CREATED'
  | 'FUNDED'
  | 'DELIVERED'
  | 'VALIDATING'
  | 'SETTLED'
  | 'DISPUTE_WINDOW'
  | 'DISPUTED'
  | 'RESOLVED'
  | 'EXPIRED'
  | 'REFUNDED'
  | 'CANCELLED'

export interface Job {
  id: bigint
  clientId: bigint
  providerId: bigint
  amount: bigint
  protocolFee: bigint
  deadline: bigint
  validationThreshold: number
  status: JobStatus
  createdAt: bigint
  fundedAt?: bigint
  deliveredAt?: bigint
  settledAt?: bigint
  deliverableHash?: Hash
  validationScore?: number
}

export interface CreateJobParams {
  providerId: bigint
  clientId: bigint
  amount: bigint
  deadline: bigint
  validationThreshold?: number
}

export interface JobDeliverable {
  jobId: bigint
  deliverableHash: Hash
  metadata?: string
}
```

### `packages/types/src/disputes.ts`

```typescript
import type { Address, Hash } from 'viem'

export type DisputeStatus =
  | 'OPEN'
  | 'EVIDENCE_SUBMISSION'
  | 'AUTOMATED_REVIEW'
  | 'ARBITRATION'
  | 'RESOLVED'

export interface Dispute {
  id: bigint
  jobId: bigint
  initiator: Address
  reason: string
  evidenceHash: Hash
  status: DisputeStatus
  createdAt: bigint
  resolvedAt?: bigint
  ruling?: 'CLIENT' | 'PROVIDER'
}

export interface RaiseDisputeParams {
  jobId: bigint
  reason: string
  evidenceHash: Hash
}
```

### `packages/types/src/config.ts`

```typescript
import type { Address, Chain } from 'viem'

export interface AegisContracts {
  escrow: Address
  dispute: Address
  treasury: Address
  factory: Address
}

export interface AegisConfig {
  chain?: string | Chain
  contracts?: AegisContracts
  provider?: any  // viem or ethers provider
}
```

### `packages/types/package.json`

```json
{
  "name": "@aegis/types",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "dev": "tsup src/index.ts --format cjs,esm --dts --watch",
    "clean": "rm -rf dist"
  },
  "peerDependencies": {
    "viem": "^2.0.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.5.0",
    "viem": "^2.0.0"
  }
}
```

---

## 5. ABIs Package

### `packages/abis/src/AegisEscrow.ts` (Example)

```typescript
// Auto-generated from Foundry artifact
// Do not edit manually

export const AegisEscrowAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: '_usdc', type: 'address', internalType: 'contract IERC20' },
      { name: '_identityRegistry', type: 'address', internalType: 'address' },
      { name: '_reputationRegistry', type: 'address', internalType: 'address' },
      { name: '_validationRegistry', type: 'address', internalType: 'address' }
    ],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'createJob',
    inputs: [
      { name: 'providerId', type: 'uint256', internalType: 'uint256' },
      { name: 'clientId', type: 'uint256', internalType: 'uint256' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      { name: 'deadline', type: 'uint256', internalType: 'uint256' },
      { name: 'validationThreshold', type: 'uint8', internalType: 'uint8' }
    ],
    outputs: [{ name: 'jobId', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'getJob',
    inputs: [{ name: 'jobId', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct AegisTypes.Job',
        components: [
          { name: 'clientId', type: 'uint256', internalType: 'uint256' },
          { name: 'providerId', type: 'uint256', internalType: 'uint256' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' },
          { name: 'protocolFee', type: 'uint256', internalType: 'uint256' },
          { name: 'deadline', type: 'uint256', internalType: 'uint256' },
          { name: 'validationThreshold', type: 'uint8', internalType: 'uint8' },
          { name: 'status', type: 'uint8', internalType: 'enum AegisTypes.JobStatus' },
          { name: 'createdAt', type: 'uint256', internalType: 'uint256' },
          { name: 'fundedAt', type: 'uint256', internalType: 'uint256' },
          { name: 'deliveredAt', type: 'uint256', internalType: 'uint256' },
          { name: 'settledAt', type: 'uint256', internalType: 'uint256' },
          { name: 'deliverableHash', type: 'bytes32', internalType: 'bytes32' },
          { name: 'validationScore', type: 'uint8', internalType: 'uint8' }
        ]
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'event',
    name: 'JobCreated',
    inputs: [
      { name: 'jobId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'clientId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'providerId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'deadline', type: 'uint256', indexed: false, internalType: 'uint256' }
    ],
    anonymous: false
  }
  // ... more ABI entries
] as const

export const AegisEscrowBytecode = '0x608060405234801...' as const
```

### `packages/abis/package.json`

```json
{
  "name": "@aegis/abis",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "dev": "tsup src/index.ts --format cjs,esm --dts --watch",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.5.0"
  }
}
```

---

## 6. SDK Package: Provider Adapters

### `packages/sdk/src/adapters/base.ts`

```typescript
import type { Address, Hash, TransactionRequest } from 'viem'

export interface AegisSigner {
  getAddress(): Promise<Address>
  signMessage(message: string): Promise<Hash>
}

export interface AegisProvider {
  getChainId(): Promise<number>
  getBalance(address: Address): Promise<bigint>
  call(tx: TransactionRequest): Promise<string>
  getSigner(): AegisSigner | null

  // Optional for read-only providers
  estimateGas?(tx: TransactionRequest): Promise<bigint>
}
```

### `packages/sdk/src/adapters/viem.ts`

```typescript
import type { PublicClient, WalletClient, Address, Hash } from 'viem'
import type { AegisProvider, AegisSigner } from './base'

class ViemSigner implements AegisSigner {
  constructor(private client: WalletClient) {}

  async getAddress(): Promise<Address> {
    if (!this.client.account) {
      throw new Error('No account found in wallet client')
    }
    return this.client.account.address
  }

  async signMessage(message: string): Promise<Hash> {
    if (!this.client.account) {
      throw new Error('No account found in wallet client')
    }
    return this.client.signMessage({
      account: this.client.account,
      message
    })
  }
}

export class ViemAdapter implements AegisProvider {
  private signer: AegisSigner | null = null

  constructor(private client: PublicClient | WalletClient) {
    if ('account' in client && client.account) {
      this.signer = new ViemSigner(client as WalletClient)
    }
  }

  async getChainId(): Promise<number> {
    return this.client.chain?.id || (await this.client.getChainId())
  }

  async getBalance(address: Address): Promise<bigint> {
    return this.client.getBalance({ address })
  }

  async call(tx: any): Promise<string> {
    const result = await this.client.call(tx)
    return result.data || '0x'
  }

  getSigner(): AegisSigner | null {
    return this.signer
  }

  async estimateGas(tx: any): Promise<bigint> {
    return this.client.estimateGas(tx)
  }
}
```

### `packages/sdk/src/adapters/ethers.ts`

```typescript
import type { Provider, Signer } from 'ethers'
import type { Address, Hash } from 'viem'
import type { AegisProvider, AegisSigner } from './base'

class EthersSigner implements AegisSigner {
  constructor(private signer: Signer) {}

  async getAddress(): Promise<Address> {
    return (await this.signer.getAddress()) as Address
  }

  async signMessage(message: string): Promise<Hash> {
    return (await this.signer.signMessage(message)) as Hash
  }
}

export class EthersAdapter implements AegisProvider {
  private signer: AegisSigner | null = null

  constructor(private provider: Provider | Signer) {
    if ('signMessage' in provider) {
      this.signer = new EthersSigner(provider as Signer)
      // Use signer as provider for calls
      this.provider = (provider as Signer).provider || provider
    }
  }

  async getChainId(): Promise<number> {
    const network = await (this.provider as Provider).getNetwork()
    return Number(network.chainId)
  }

  async getBalance(address: Address): Promise<bigint> {
    return (this.provider as Provider).getBalance(address)
  }

  async call(tx: any): Promise<string> {
    return (this.provider as Provider).call(tx)
  }

  getSigner(): AegisSigner | null {
    return this.signer
  }

  async estimateGas(tx: any): Promise<bigint> {
    return (this.provider as Provider).estimateGas(tx)
  }
}
```

---

## 7. SDK Package: Service Modules

### `packages/sdk/src/escrow/index.ts`

```typescript
import type { Address, Hash } from 'viem'
import { AegisEscrowAbi } from '@aegis/abis'
import type { AegisProvider } from '../adapters/base'
import type { CreateJobParams, Job, JobDeliverable } from '@aegis/types'

export interface EscrowService {
  createJob(params: CreateJobParams): Promise<bigint>
  getJob(jobId: bigint): Promise<Job>
  deliverWork(deliverable: JobDeliverable): Promise<Hash>
  processValidation(jobId: bigint): Promise<Hash>
}

export function createEscrow(
  provider: AegisProvider,
  address: Address
): EscrowService {
  return {
    async createJob(params: CreateJobParams): Promise<bigint> {
      const signer = provider.getSigner()
      if (!signer) {
        throw new Error('Signer required for createJob')
      }

      // Implementation depends on provider type
      // This is a simplified example
      const data = encodeFunctionData({
        abi: AegisEscrowAbi,
        functionName: 'createJob',
        args: [
          params.providerId,
          params.clientId,
          params.amount,
          params.deadline,
          params.validationThreshold || 70
        ]
      })

      // Send transaction (implementation varies by provider)
      // Return jobId from transaction receipt
      throw new Error('Not implemented - see full SDK implementation')
    },

    async getJob(jobId: bigint): Promise<Job> {
      const result = await provider.call({
        to: address,
        data: encodeFunctionData({
          abi: AegisEscrowAbi,
          functionName: 'getJob',
          args: [jobId]
        })
      })

      const decoded = decodeFunctionResult({
        abi: AegisEscrowAbi,
        functionName: 'getJob',
        data: result as Hash
      })

      return parseJobFromContract(decoded)
    },

    async deliverWork(deliverable: JobDeliverable): Promise<Hash> {
      const signer = provider.getSigner()
      if (!signer) {
        throw new Error('Signer required for deliverWork')
      }

      // Implementation
      throw new Error('Not implemented - see full SDK implementation')
    },

    async processValidation(jobId: bigint): Promise<Hash> {
      // Implementation
      throw new Error('Not implemented - see full SDK implementation')
    }
  }
}

function parseJobFromContract(data: any): Job {
  return {
    id: data.jobId,
    clientId: data.clientId,
    providerId: data.providerId,
    amount: data.amount,
    protocolFee: data.protocolFee,
    deadline: data.deadline,
    validationThreshold: data.validationThreshold,
    status: parseJobStatus(data.status),
    createdAt: data.createdAt,
    fundedAt: data.fundedAt > 0 ? data.fundedAt : undefined,
    deliveredAt: data.deliveredAt > 0 ? data.deliveredAt : undefined,
    settledAt: data.settledAt > 0 ? data.settledAt : undefined,
    deliverableHash: data.deliverableHash !== '0x0' ? data.deliverableHash : undefined,
    validationScore: data.validationScore > 0 ? data.validationScore : undefined
  }
}

function parseJobStatus(status: number): Job['status'] {
  const statuses = [
    'CREATED', 'FUNDED', 'DELIVERED', 'VALIDATING', 'SETTLED',
    'DISPUTE_WINDOW', 'DISPUTED', 'RESOLVED', 'EXPIRED', 'REFUNDED', 'CANCELLED'
  ]
  return statuses[status] as Job['status']
}
```

### `packages/sdk/src/dispute/index.ts`

```typescript
import type { Address, Hash } from 'viem'
import { AegisDisputeAbi } from '@aegis/abis'
import type { AegisProvider } from '../adapters/base'
import type { RaiseDisputeParams, Dispute } from '@aegis/types'

export interface DisputeService {
  raiseDispute(params: RaiseDisputeParams): Promise<bigint>
  getDispute(disputeId: bigint): Promise<Dispute>
  submitEvidence(disputeId: bigint, evidenceHash: Hash): Promise<Hash>
  resolveDispute(disputeId: bigint): Promise<Hash>
}

export function createDispute(
  provider: AegisProvider,
  address: Address
): DisputeService {
  return {
    async raiseDispute(params: RaiseDisputeParams): Promise<bigint> {
      // Implementation
      throw new Error('Not implemented - see full SDK implementation')
    },

    async getDispute(disputeId: bigint): Promise<Dispute> {
      // Implementation
      throw new Error('Not implemented - see full SDK implementation')
    },

    async submitEvidence(disputeId: bigint, evidenceHash: Hash): Promise<Hash> {
      // Implementation
      throw new Error('Not implemented - see full SDK implementation')
    },

    async resolveDispute(disputeId: bigint): Promise<Hash> {
      // Implementation
      throw new Error('Not implemented - see full SDK implementation')
    }
  }
}
```

---

## 8. SDK Package: Unified Client

### `packages/sdk/src/chains.ts`

```typescript
import type { AegisContracts } from '@aegis/types'

export const AEGIS_ADDRESSES: Record<string, AegisContracts> = {
  base: {
    escrow: '0x...',  // Mainnet addresses (TBD)
    dispute: '0x...',
    treasury: '0x...',
    factory: '0x...'
  },
  baseSepolia: {
    escrow: '0x...',  // From deployment script
    dispute: '0x...',
    treasury: '0x...',
    factory: '0x...'
  }
} as const
```

### `packages/sdk/src/client.ts`

```typescript
import type { Chain } from 'viem'
import type { AegisConfig, AegisContracts } from '@aegis/types'
import { ViemAdapter } from './adapters/viem'
import { EthersAdapter } from './adapters/ethers'
import type { AegisProvider } from './adapters/base'
import { createEscrow, type EscrowService } from './escrow'
import { createDispute, type DisputeService } from './dispute'
import { createTreasury, type TreasuryService } from './treasury'
import { createFactory, type FactoryService } from './factory'
import { AEGIS_ADDRESSES } from './chains'

export interface AegisClient {
  escrow: EscrowService
  dispute: DisputeService
  treasury: TreasuryService
  factory: FactoryService
}

export function createAegisClient(config: AegisConfig): AegisClient {
  // Resolve provider
  const provider = createProvider(config.provider)

  // Resolve contract addresses
  const contracts = resolveContracts(config)

  return {
    escrow: createEscrow(provider, contracts.escrow),
    dispute: createDispute(provider, contracts.dispute),
    treasury: createTreasury(provider, contracts.treasury),
    factory: createFactory(provider, contracts.factory)
  }
}

function createProvider(provider: any): AegisProvider {
  // Auto-detect provider type
  if ('request' in provider && 'chain' in provider) {
    // viem PublicClient or WalletClient
    return new ViemAdapter(provider)
  } else if ('getNetwork' in provider) {
    // ethers Provider or Signer
    return new EthersAdapter(provider)
  } else if (provider instanceof ViemAdapter || provider instanceof EthersAdapter) {
    // Already an adapter
    return provider
  }

  throw new Error(
    'Unsupported provider. Use viem PublicClient/WalletClient or ethers Provider/Signer'
  )
}

function resolveContracts(config: AegisConfig): AegisContracts {
  // If contracts explicitly provided, use them
  if (config.contracts) {
    return config.contracts
  }

  // Otherwise, use chain defaults
  if (!config.chain) {
    throw new Error('Either chain or contracts must be provided')
  }

  const chainName = typeof config.chain === 'string' ? config.chain : config.chain.name

  const addresses = AEGIS_ADDRESSES[chainName]
  if (!addresses) {
    throw new Error(
      `No default addresses for chain "${chainName}". Provide contracts explicitly.`
    )
  }

  return addresses
}
```

### `packages/sdk/src/index.ts`

```typescript
// Main exports
export { createAegisClient, type AegisClient } from './client'

// Service modules (for individual use)
export { createEscrow, type EscrowService } from './escrow'
export { createDispute, type DisputeService } from './dispute'
export { createTreasury, type TreasuryService } from './treasury'
export { createFactory, type FactoryService } from './factory'

// Adapters
export { ViemAdapter } from './adapters/viem'
export { EthersAdapter } from './adapters/ethers'
export type { AegisProvider, AegisSigner } from './adapters/base'

// Chain config
export { AEGIS_ADDRESSES } from './chains'

// Re-export types
export type * from '@aegis/types'
```

### `packages/sdk/package.json`

```json
{
  "name": "@aegis/sdk",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./adapters": {
      "import": "./dist/adapters/index.mjs",
      "require": "./dist/adapters/index.js",
      "types": "./dist/adapters/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts src/adapters/index.ts --format cjs,esm --dts",
    "dev": "tsup src/index.ts src/adapters/index.ts --format cjs,esm --dts --watch",
    "test": "vitest",
    "clean": "rm -rf dist"
  },
  "peerDependencies": {
    "viem": "^2.0.0",
    "ethers": "^6.0.0"
  },
  "peerDependenciesMeta": {
    "viem": {
      "optional": true
    },
    "ethers": {
      "optional": true
    }
  },
  "dependencies": {
    "@aegis/abis": "workspace:*",
    "@aegis/types": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.5.0",
    "viem": "^2.0.0",
    "ethers": "^6.0.0",
    "vitest": "^1.0.0"
  }
}
```

---

## 9. Usage Examples

### Example 1: viem (Modern, Recommended)

```typescript
import { createPublicClient, createWalletClient, http } from 'viem'
import { baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { createAegisClient } from '@aegis/sdk'

// Create viem clients
const account = privateKeyToAccount('0x...')

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http()
})

// Create AEGIS client (uses default addresses for baseSepolia)
const aegis = createAegisClient({
  chain: 'baseSepolia',
  provider: walletClient
})

// Create a job
const jobId = await aegis.escrow.createJob({
  providerId: 123n,
  clientId: 456n,
  amount: 1_000_000n,  // 1 USDC (6 decimals)
  deadline: BigInt(Date.now() / 1000 + 86400)  // 24 hours
})

console.log('Job created:', jobId)

// Get job details
const job = await aegis.escrow.getJob(jobId)
console.log('Job status:', job.status)

// Deliver work (as provider)
await aegis.escrow.deliverWork({
  jobId,
  deliverableHash: '0x...',
  metadata: 'ipfs://...'
})

// Process validation (permissionless)
await aegis.escrow.processValidation(jobId)
```

### Example 2: ethers v6 (Legacy Support)

```typescript
import { ethers } from 'ethers'
import { createAegisClient } from '@aegis/sdk'

// Create ethers provider + signer
const provider = new ethers.JsonRpcProvider('https://sepolia.base.org')
const wallet = new ethers.Wallet('0x...', provider)

// Create AEGIS client
const aegis = createAegisClient({
  chain: 'baseSepolia',
  provider: wallet
})

// Same API as viem example
const jobId = await aegis.escrow.createJob({ ... })
```

### Example 3: Individual Service Modules (Tree-shakeable)

```typescript
import { createPublicClient, http } from 'viem'
import { baseSepolia } from 'viem/chains'
import { createEscrow, AEGIS_ADDRESSES } from '@aegis/sdk'
import { ViemAdapter } from '@aegis/sdk/adapters'

const client = createPublicClient({
  chain: baseSepolia,
  transport: http()
})

const provider = new ViemAdapter(client)

// Only import escrow service (smaller bundle)
const escrow = createEscrow(
  provider,
  AEGIS_ADDRESSES.baseSepolia.escrow
)

const job = await escrow.getJob(123n)
```

### Example 4: Custom Deployment (Fork or Private Chain)

```typescript
import { createAegisClient } from '@aegis/sdk'

const aegis = createAegisClient({
  provider: walletClient,
  contracts: {
    escrow: '0xCustomEscrow...',
    dispute: '0xCustomDispute...',
    treasury: '0xCustomTreasury...',
    factory: '0xCustomFactory...'
  }
})
```

---

## 10. Testing Example

### `packages/sdk/src/escrow/index.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { createPublicClient, http, parseEther } from 'viem'
import { foundry } from 'viem/chains'
import { createEscrow } from './index'
import { ViemAdapter } from '../adapters/viem'

describe('EscrowService', () => {
  let escrow: ReturnType<typeof createEscrow>

  beforeAll(() => {
    const client = createPublicClient({
      chain: foundry,
      transport: http()
    })

    escrow = createEscrow(
      new ViemAdapter(client),
      '0x5FbDB2315678afecb367f032d93F642f64180aa3'  // Anvil address
    )
  })

  it('should get job details', async () => {
    const job = await escrow.getJob(1n)
    expect(job.id).toBe(1n)
    expect(job.status).toBe('CREATED')
  })

  // More tests...
})
```

---

## Summary

This SDK architecture follows industry best practices from 7 major Web3 SDKs:

**✅ Modern patterns:**
- pnpm + Turborepo monorepo
- abitype type inference (no TypeChain)
- viem-first with ethers adapter
- Functional + unified client API
- tsup for fast builds

**✅ Proven patterns:**
- Adapter pattern for provider abstraction (Safe, thirdweb)
- Service modules + unified client (thirdweb v5, Across)
- Hardcoded + override addresses (Uniswap, Hyperlane)
- Auto-generated ABIs from Foundry (wagmi CLI pattern)

**🚀 Next steps:**
1. Implement remaining service methods
2. Add event listening/filtering
3. Write comprehensive tests
4. Generate TypeDoc documentation
5. Publish to npm
