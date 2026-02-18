# AEGIS Protocol TypeScript SDK — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build `@aegis-protocol/sdk` — a TypeScript monorepo with 3 packages (types, abis, sdk) wrapping all AEGIS contracts behind a type-safe, dual-provider (viem + ethers) API.

**Architecture:** pnpm monorepo with Turborepo. ABIs auto-generated from Foundry `out/`. Provider abstraction via adapter pattern. Unified `AegisClient` entry point with tree-shakeable subpath exports. ESM + CJS dual output via tsup.

**Tech Stack:** TypeScript 5.x, pnpm, Turborepo, tsup, vitest, viem ^2.0, ethers ^6.0 (optional peer dep), abitype

**Design Doc:** `docs/plans/2026-02-15-typescript-sdk-design.md`

---

## Task 1: Monorepo Scaffolding

**Files:**
- Create: `sdk/package.json`
- Create: `sdk/pnpm-workspace.yaml`
- Create: `sdk/turbo.json`
- Create: `sdk/tsconfig.base.json`
- Create: `sdk/.gitignore`
- Create: `sdk/packages/types/package.json`
- Create: `sdk/packages/types/tsconfig.json`
- Create: `sdk/packages/abis/package.json`
- Create: `sdk/packages/abis/tsconfig.json`
- Create: `sdk/packages/sdk/package.json`
- Create: `sdk/packages/sdk/tsconfig.json`
- Create: `sdk/packages/sdk/tsup.config.ts`

### Step 1: Create root monorepo configuration

Create `sdk/package.json`:
```json
{
  "name": "@aegis-protocol/monorepo",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "clean": "turbo run clean",
    "generate:abis": "pnpm --filter @aegis-protocol/abis generate"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.5.0"
  },
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

Create `sdk/pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
```

Create `sdk/turbo.json`:
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "clean": {
      "cache": false
    }
  }
}
```

Create `sdk/tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

Create `sdk/.gitignore`:
```
node_modules/
dist/
.turbo/
*.tsbuildinfo
```

### Step 2: Create `@aegis-protocol/types` package shell

Create `sdk/packages/types/package.json`:
```json
{
  "name": "@aegis-protocol/types",
  "version": "0.1.0",
  "description": "TypeScript type definitions for AEGIS Protocol",
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
    "build": "tsup",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.5.0"
  },
  "files": ["dist"],
  "license": "MIT"
}
```

Create `sdk/packages/types/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

Create `sdk/packages/types/tsup.config.ts`:
```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  sourcemap: true,
});
```

### Step 3: Create `@aegis-protocol/abis` package shell

Create `sdk/packages/abis/package.json`:
```json
{
  "name": "@aegis-protocol/abis",
  "version": "0.1.0",
  "description": "Contract ABIs for AEGIS Protocol (const assertions for abitype)",
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
    "generate": "tsx scripts/generate.ts",
    "build": "tsup",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.5.0"
  },
  "files": ["dist"],
  "license": "MIT"
}
```

Create `sdk/packages/abis/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

Create `sdk/packages/abis/tsup.config.ts`:
```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  sourcemap: true,
});
```

### Step 4: Create `@aegis-protocol/sdk` package shell

Create `sdk/packages/sdk/package.json`:
```json
{
  "name": "@aegis-protocol/sdk",
  "version": "0.1.0",
  "description": "TypeScript SDK for AEGIS Protocol — trustless escrow for AI agent transactions",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./escrow": {
      "import": "./dist/escrow.mjs",
      "require": "./dist/escrow.js",
      "types": "./dist/escrow.d.ts"
    },
    "./dispute": {
      "import": "./dist/dispute.mjs",
      "require": "./dist/dispute.js",
      "types": "./dist/dispute.d.ts"
    },
    "./treasury": {
      "import": "./dist/treasury.mjs",
      "require": "./dist/treasury.js",
      "types": "./dist/treasury.d.ts"
    },
    "./factory": {
      "import": "./dist/factory.mjs",
      "require": "./dist/factory.js",
      "types": "./dist/factory.d.ts"
    },
    "./utils": {
      "import": "./dist/utils.mjs",
      "require": "./dist/utils.js",
      "types": "./dist/utils.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@aegis-protocol/types": "workspace:*",
    "@aegis-protocol/abis": "workspace:*"
  },
  "peerDependencies": {
    "viem": "^2.0.0",
    "ethers": "^6.0.0"
  },
  "peerDependenciesMeta": {
    "viem": { "optional": true },
    "ethers": { "optional": true }
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.5.0",
    "viem": "^2.0.0",
    "vitest": "^2.0.0"
  },
  "files": ["dist"],
  "license": "MIT"
}
```

Create `sdk/packages/sdk/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

Create `sdk/packages/sdk/tsup.config.ts`:
```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    escrow: "src/escrow.ts",
    dispute: "src/dispute.ts",
    treasury: "src/treasury.ts",
    factory: "src/factory.ts",
    utils: "src/utils/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ["viem", "ethers"],
});
```

### Step 5: Install dependencies and verify monorepo

Run:
```bash
cd sdk && pnpm install
```
Expected: Dependencies install, pnpm links workspace packages.

Run:
```bash
cd sdk && pnpm turbo build --dry-run
```
Expected: Turbo shows build order: types → abis → sdk.

### Step 6: Commit

```bash
git add sdk/
git commit -m "feat(sdk): scaffold monorepo with pnpm + turborepo

Three packages: @aegis-protocol/types, /abis, /sdk
tsup for ESM+CJS dual output, vitest for testing"
```

---

## Task 2: ABI Generation Script

**Files:**
- Create: `sdk/packages/abis/scripts/generate.ts`
- Create: `sdk/packages/abis/src/index.ts`
- Create: `sdk/packages/abis/src/AegisEscrow.ts` (generated)
- Create: `sdk/packages/abis/src/AegisDispute.ts` (generated)
- Create: `sdk/packages/abis/src/AegisTreasury.ts` (generated)
- Create: `sdk/packages/abis/src/AegisJobFactory.ts` (generated)
- Create: `sdk/packages/abis/src/erc8004/Identity.ts` (generated)
- Create: `sdk/packages/abis/src/erc8004/Reputation.ts` (generated)
- Create: `sdk/packages/abis/src/erc8004/Validation.ts` (generated)

### Step 1: Write the ABI generation script

Create `sdk/packages/abis/scripts/generate.ts`:
```typescript
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";

// Path to Foundry compilation output (relative to this script)
const FOUNDRY_OUT = join(__dirname, "../../../../out");

// Contracts to extract ABIs from
const CONTRACTS: Array<{
  /** Path inside out/: ContractFile.sol/ContractName.json */
  artifact: string;
  /** Output file path inside src/ */
  output: string;
  /** Export name: e.g. aegisEscrowAbi */
  exportName: string;
}> = [
  {
    artifact: "AegisEscrow.sol/AegisEscrow.json",
    output: "src/AegisEscrow.ts",
    exportName: "aegisEscrowAbi",
  },
  {
    artifact: "AegisDispute.sol/AegisDispute.json",
    output: "src/AegisDispute.ts",
    exportName: "aegisDisputeAbi",
  },
  {
    artifact: "AegisTreasury.sol/AegisTreasury.json",
    output: "src/AegisTreasury.ts",
    exportName: "aegisTreasuryAbi",
  },
  {
    artifact: "AegisJobFactory.sol/AegisJobFactory.json",
    output: "src/AegisJobFactory.ts",
    exportName: "aegisJobFactoryAbi",
  },
  {
    artifact: "Mocks.sol/MockIdentityRegistry.json",
    output: "src/erc8004/Identity.ts",
    exportName: "erc8004IdentityAbi",
  },
  {
    artifact: "Mocks.sol/MockReputationRegistry.json",
    output: "src/erc8004/Reputation.ts",
    exportName: "erc8004ReputationAbi",
  },
  {
    artifact: "Mocks.sol/MockValidationRegistry.json",
    output: "src/erc8004/Validation.ts",
    exportName: "erc8004ValidationAbi",
  },
];

function generate() {
  console.log("Generating ABI exports from Foundry output...\n");

  for (const contract of CONTRACTS) {
    const artifactPath = join(FOUNDRY_OUT, contract.artifact);

    if (!existsSync(artifactPath)) {
      console.error(`  SKIP: ${contract.artifact} — file not found`);
      console.error(`         Expected at: ${artifactPath}`);
      continue;
    }

    const raw = readFileSync(artifactPath, "utf-8");
    const artifact = JSON.parse(raw);
    const abi = artifact.abi;

    if (!abi || !Array.isArray(abi)) {
      console.error(`  SKIP: ${contract.artifact} — no ABI array found`);
      continue;
    }

    const outputPath = join(__dirname, "..", contract.output);
    const outputDir = dirname(outputPath);

    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const content = [
      `// Auto-generated from Foundry artifact: ${contract.artifact}`,
      `// Do not edit manually — run \`pnpm generate\` to regenerate`,
      ``,
      `export const ${contract.exportName} = ${JSON.stringify(abi, null, 2)} as const;`,
      ``,
    ].join("\n");

    writeFileSync(outputPath, content, "utf-8");
    console.log(`  OK: ${contract.output} (${abi.length} entries)`);
  }

  console.log("\nDone.");
}

generate();
```

### Step 2: Run the generation script

Run:
```bash
cd sdk/packages/abis && pnpm generate
```
Expected: 7 `.ts` files generated in `src/`, each containing a `const` ABI export.

### Step 3: Write the barrel export

Create `sdk/packages/abis/src/index.ts`:
```typescript
export { aegisEscrowAbi } from "./AegisEscrow";
export { aegisDisputeAbi } from "./AegisDispute";
export { aegisTreasuryAbi } from "./AegisTreasury";
export { aegisJobFactoryAbi } from "./AegisJobFactory";
export { erc8004IdentityAbi } from "./erc8004/Identity";
export { erc8004ReputationAbi } from "./erc8004/Reputation";
export { erc8004ValidationAbi } from "./erc8004/Validation";
```

### Step 4: Build the abis package

Run:
```bash
cd sdk && pnpm --filter @aegis-protocol/abis build
```
Expected: `dist/` produced with ESM + CJS + `.d.ts` files.

### Step 5: Commit

```bash
git add sdk/packages/abis/
git commit -m "feat(sdk): add ABI generation script

Extracts const ABIs from Foundry out/ for full abitype inference.
7 contracts: Escrow, Dispute, Treasury, Factory, 3 ERC-8004 mocks."
```

---

## Task 3: Types Package

**Files:**
- Create: `sdk/packages/types/src/index.ts`
- Create: `sdk/packages/types/src/enums.ts`
- Create: `sdk/packages/types/src/contracts.ts`
- Create: `sdk/packages/types/src/errors.ts`
- Create: `sdk/packages/types/src/config.ts`
- Test: `sdk/packages/types/src/__tests__/enums.test.ts`

### Step 1: Write the failing test for enums

Create `sdk/packages/types/src/__tests__/enums.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { JobState, DisputeResolution } from "../enums";

describe("JobState", () => {
  it("maps CREATED to 0", () => {
    expect(JobState.CREATED).toBe(0);
  });

  it("maps CANCELLED to 10", () => {
    expect(JobState.CANCELLED).toBe(10);
  });

  it("has 11 states", () => {
    expect(Object.keys(JobState).filter((k) => isNaN(Number(k))).length).toBe(11);
  });
});

describe("DisputeResolution", () => {
  it("maps NONE to 0", () => {
    expect(DisputeResolution.NONE).toBe(0);
  });

  it("maps CLIENT_CONFIRM to 4", () => {
    expect(DisputeResolution.CLIENT_CONFIRM).toBe(4);
  });

  it("has 5 resolutions", () => {
    expect(Object.keys(DisputeResolution).filter((k) => isNaN(Number(k))).length).toBe(5);
  });
});
```

Add vitest to the types package:
```json
// Add to sdk/packages/types/package.json scripts:
"test": "vitest run"
// Add to devDependencies:
"vitest": "^2.0.0"
```

### Step 2: Run test to verify it fails

Run:
```bash
cd sdk/packages/types && pnpm test
```
Expected: FAIL — `Cannot find module '../enums'`

### Step 3: Write the enums module

Create `sdk/packages/types/src/enums.ts`:
```typescript
/**
 * Job lifecycle states — matches AegisTypes.JobState in Solidity.
 *
 * State machine:
 *   CREATED → FUNDED → DELIVERED → VALIDATING → SETTLED
 *                                       ↘ DISPUTE_WINDOW → DISPUTED → RESOLVED
 *              ↘ EXPIRED → REFUNDED
 *   CREATED → CANCELLED (before funding)
 */
export enum JobState {
  CREATED = 0,
  FUNDED = 1,
  DELIVERED = 2,
  VALIDATING = 3,
  DISPUTE_WINDOW = 4,
  SETTLED = 5,
  DISPUTED = 6,
  RESOLVED = 7,
  EXPIRED = 8,
  REFUNDED = 9,
  CANCELLED = 10,
}

/**
 * How a job was resolved — matches AegisTypes.DisputeResolution in Solidity.
 */
export enum DisputeResolution {
  NONE = 0,
  RE_VALIDATION = 1,
  ARBITRATOR = 2,
  TIMEOUT_DEFAULT = 3,
  CLIENT_CONFIRM = 4,
}
```

### Step 4: Run test to verify it passes

Run:
```bash
cd sdk/packages/types && pnpm test
```
Expected: PASS — all 6 tests pass.

### Step 5: Write the contracts types module

Create `sdk/packages/types/src/contracts.ts`:
```typescript
import { JobState, DisputeResolution } from "./enums";

/** Hex-prefixed string type for addresses and bytes32 */
export type Hex = `0x${string}`;

/**
 * On-chain Job struct — matches AegisTypes.Job in Solidity.
 * All uint256 fields are bigint. uint8 fields are number.
 */
export interface Job {
  clientAgentId: bigint;
  providerAgentId: bigint;
  clientAddress: Hex;
  providerWallet: Hex;
  jobSpecHash: Hex;
  jobSpecURI: string;
  templateId: bigint;
  validatorAddress: Hex;
  validationRequestHash: Hex;
  validationScore: number;
  validationThreshold: number;
  amount: bigint;
  protocolFeeBps: bigint;
  createdAt: bigint;
  deadline: bigint;
  deliveredAt: bigint;
  settledAt: bigint;
  disputeWindowEnd: bigint;
  deliverableHash: Hex;
  deliverableURI: string;
  state: JobState;
  resolution: DisputeResolution;
}

/**
 * On-chain Dispute struct — matches AegisTypes.Dispute in Solidity.
 */
export interface Dispute {
  jobId: Hex;
  initiator: Hex;
  respondent: Hex;
  initiatorEvidenceURI: string;
  initiatorEvidenceHash: Hex;
  respondentEvidenceURI: string;
  respondentEvidenceHash: Hex;
  respondentSubmitted: boolean;
  arbitrator: Hex;
  ruling: number;
  rationaleURI: string;
  rationaleHash: Hex;
  createdAt: bigint;
  evidenceDeadline: bigint;
  resolutionDeadline: bigint;
  initiatorBond: bigint;
  resolved: boolean;
  method: DisputeResolution;
}

/**
 * On-chain JobTemplate struct — matches AegisTypes.JobTemplate in Solidity.
 */
export interface JobTemplate {
  name: string;
  defaultValidator: Hex;
  defaultTimeout: bigint;
  feeBps: bigint;
  minValidation: number;
  defaultDisputeSplit: number;
  active: boolean;
  creator: Hex;
}

/**
 * Arbitrator stats — from AegisDispute.sol ArbitratorStats struct.
 */
export interface ArbitratorStats {
  totalResolutions: bigint;
  successfulResolutions: bigint;
  totalFeesEarned: bigint;
  lastActiveAt: bigint;
}
```

### Step 6: Write the config types module

Create `sdk/packages/types/src/config.ts`:
```typescript
import type { Hex } from "./contracts";

/** Deployed contract addresses for a specific chain */
export interface ContractAddresses {
  escrow: Hex;
  dispute: Hex;
  treasury: Hex;
  factory: Hex;
  usdc: Hex;
  identityRegistry: Hex;
  reputationRegistry: Hex;
  validationRegistry: Hex;
}

/** Chain configuration */
export interface ChainConfig {
  chainId: number;
  rpcUrl: string;
  contracts: ContractAddresses;
}

/** Supported chain names */
export type SupportedChain = "base-sepolia" | "base";

/** Pre-configured chain configs */
export const CHAIN_CONFIGS: Record<SupportedChain, ChainConfig> = {
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
  base: {
    chainId: 8453,
    rpcUrl: "https://mainnet.base.org",
    contracts: {
      escrow: "0x0000000000000000000000000000000000000000",
      dispute: "0x0000000000000000000000000000000000000000",
      treasury: "0x0000000000000000000000000000000000000000",
      factory: "0x0000000000000000000000000000000000000000",
      usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      identityRegistry: "0x0000000000000000000000000000000000000000",
      reputationRegistry: "0x0000000000000000000000000000000000000000",
      validationRegistry: "0x0000000000000000000000000000000000000000",
    },
  },
};

/** Options for creating an AegisClient */
export interface ClientOptions {
  /** Chain name or custom chain config */
  chain: SupportedChain | ChainConfig;
  /** Override default contract addresses */
  contracts?: Partial<ContractAddresses>;
}
```

### Step 7: Write the errors types module

Create `sdk/packages/types/src/errors.ts`:
```typescript
import type { Hex } from "./contracts";
import type { JobState } from "./enums";

/**
 * Discriminated union of all Solidity custom errors from AegisTypes.sol.
 * SDK methods decode raw reverts into these typed errors.
 */
export type AegisContractErrorData =
  // Identity
  | { name: "AgentNotRegistered"; args: { agentId: bigint } }
  | { name: "NotAgentOwner"; args: { agentId: bigint; caller: Hex } }
  | { name: "AgentWalletNotSet"; args: { agentId: bigint } }
  // Job
  | { name: "InvalidJobState"; args: { jobId: Hex; current: JobState; expected: JobState } }
  | { name: "JobNotFound"; args: { jobId: Hex } }
  | { name: "DeadlinePassed"; args: { jobId: Hex; deadline: bigint } }
  | { name: "DeadlineNotPassed"; args: { jobId: Hex; deadline: bigint } }
  | { name: "InsufficientAmount"; args: { provided: bigint; required: bigint } }
  | { name: "SameAgent"; args: { agentId: bigint } }
  | { name: "InvalidDeadline"; args: { deadline: bigint } }
  | { name: "InvalidThreshold"; args: { threshold: number } }
  // Validation
  | { name: "InvalidValidator"; args: { validator: Hex } }
  | { name: "ValidationNotComplete"; args: { jobId: Hex } }
  | { name: "ValidationAlreadyRequested"; args: { jobId: Hex } }
  // Dispute
  | { name: "DisputeWindowClosed"; args: { jobId: Hex } }
  | { name: "DisputeWindowOpen"; args: { jobId: Hex } }
  | { name: "NotJobParty"; args: { jobId: Hex; caller: Hex } }
  | { name: "DisputeAlreadyExists"; args: { jobId: Hex } }
  | { name: "DisputeNotFound"; args: { disputeId: Hex } }
  | { name: "DisputeAlreadyResolved"; args: { disputeId: Hex } }
  | { name: "EvidenceWindowClosed"; args: { disputeId: Hex } }
  | { name: "NotArbitrator"; args: { disputeId: Hex; caller: Hex } }
  | { name: "InvalidRuling"; args: { ruling: number } }
  | { name: "InsufficientBond"; args: { provided: bigint; required: bigint } }
  | { name: "ResolutionDeadlineNotPassed"; args: { disputeId: Hex } }
  // Treasury
  | { name: "NotAuthorized"; args: { caller: Hex } }
  | { name: "InsufficientBalance"; args: { requested: bigint; available: bigint } }
  // Template
  | { name: "TemplateNotFound"; args: { templateId: bigint } }
  | { name: "TemplateNotActive"; args: { templateId: bigint } }
  // General
  | { name: "ZeroAddress"; args: Record<string, never> }
  | { name: "TransferFailed"; args: Record<string, never> };

/** Typed error thrown when a contract call reverts with a known custom error */
export class AegisContractError extends Error {
  public readonly data: AegisContractErrorData;

  constructor(data: AegisContractErrorData) {
    super(`AEGIS contract error: ${data.name}`);
    this.name = "AegisContractError";
    this.data = data;
  }
}

/** Error thrown when the RPC provider fails */
export class AegisProviderError extends Error {
  public readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AegisProviderError";
    this.cause = cause;
  }
}

/** Error thrown for client-side validation failures (before tx submission) */
export class AegisValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AegisValidationError";
  }
}
```

### Step 8: Write the barrel export

Create `sdk/packages/types/src/index.ts`:
```typescript
// Enums
export { JobState, DisputeResolution } from "./enums";

// Structs
export type { Job, Dispute, JobTemplate, ArbitratorStats, Hex } from "./contracts";

// Config
export type {
  ContractAddresses,
  ChainConfig,
  SupportedChain,
  ClientOptions,
} from "./config";
export { CHAIN_CONFIGS } from "./config";

// Errors
export type { AegisContractErrorData } from "./errors";
export { AegisContractError, AegisProviderError, AegisValidationError } from "./errors";
```

### Step 9: Run tests to verify

Run:
```bash
cd sdk/packages/types && pnpm test
```
Expected: PASS — all enum tests pass.

### Step 10: Build the types package

Run:
```bash
cd sdk && pnpm --filter @aegis-protocol/types build
```
Expected: `dist/` produced with all types, enums, config, errors.

### Step 11: Commit

```bash
git add sdk/packages/types/
git commit -m "feat(sdk): add types package

Enums (JobState, DisputeResolution), struct interfaces (Job, Dispute,
JobTemplate, ArbitratorStats), chain config with deployed addresses,
typed error classes (AegisContractError, ProviderError, ValidationError)."
```

---

## Task 4: Provider Abstraction

**Files:**
- Create: `sdk/packages/sdk/src/provider.ts`
- Create: `sdk/packages/sdk/src/adapters/viem.ts`
- Create: `sdk/packages/sdk/src/adapters/ethers.ts`
- Create: `sdk/packages/sdk/src/adapters/index.ts`
- Test: `sdk/packages/sdk/src/__tests__/provider.test.ts`

### Step 1: Write the failing test for provider interface

Create `sdk/packages/sdk/src/__tests__/provider.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { ViemAdapter } from "../adapters/viem";
import { createPublicClient, createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// Use a throwaway test key (never holds real funds)
const TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

describe("ViemAdapter", () => {
  it("creates from wallet + public client", () => {
    const account = privateKeyToAccount(TEST_KEY);
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(),
    });

    const adapter = new ViemAdapter(walletClient, publicClient);
    expect(adapter).toBeDefined();
    expect(adapter.getAddress()).resolves.toMatch(/^0x/);
  });

  it("creates read-only from public client only", () => {
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });

    const adapter = ViemAdapter.readOnly(publicClient);
    expect(adapter).toBeDefined();
    expect(adapter.getAddress()).rejects.toThrow();
  });
});
```

### Step 2: Run test to verify it fails

Run:
```bash
cd sdk/packages/sdk && pnpm test -- --run src/__tests__/provider.test.ts
```
Expected: FAIL — `Cannot find module '../adapters/viem'`

### Step 3: Write the provider interface

Create `sdk/packages/sdk/src/provider.ts`:
```typescript
import type { Hex } from "@aegis-protocol/types";

/** Parameters for reading a contract */
export interface ReadContractParams {
  address: Hex;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
}

/** Parameters for writing to a contract */
export interface WriteContractParams {
  address: Hex;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}

/** Simplified transaction receipt */
export interface TransactionReceipt {
  transactionHash: Hex;
  blockNumber: bigint;
  status: "success" | "reverted";
  logs: readonly unknown[];
}

/** Parameters for watching contract events */
export interface WatchEventParams {
  address: Hex;
  abi: readonly unknown[];
  eventName: string;
  onLogs: (logs: readonly unknown[]) => void;
}

/**
 * Provider abstraction — adapts viem or ethers to a common interface.
 * All SDK service modules depend only on this interface.
 */
export interface AegisProvider {
  /** Read a contract view/pure function */
  readContract<T = unknown>(params: ReadContractParams): Promise<T>;

  /** Send a write transaction (returns tx hash) */
  writeContract(params: WriteContractParams): Promise<Hex>;

  /** Wait for a transaction to be confirmed */
  waitForTransaction(hash: Hex): Promise<TransactionReceipt>;

  /** Watch for contract events (returns unsubscribe function) */
  watchContractEvent(params: WatchEventParams): () => void;

  /** Get the connected wallet address (throws if read-only) */
  getAddress(): Promise<Hex>;

  /** Get the connected chain ID */
  getChainId(): Promise<number>;

  /** Whether this provider can sign transactions */
  readonly isReadOnly: boolean;
}
```

### Step 4: Write the viem adapter

Create `sdk/packages/sdk/src/adapters/viem.ts`:
```typescript
import type {
  PublicClient,
  WalletClient,
  GetContractReturnType,
} from "viem";
import type { Hex } from "@aegis-protocol/types";
import type {
  AegisProvider,
  ReadContractParams,
  WriteContractParams,
  TransactionReceipt,
  WatchEventParams,
} from "../provider";

export class ViemAdapter implements AegisProvider {
  private readonly walletClient: WalletClient | null;
  private readonly publicClient: PublicClient;

  public readonly isReadOnly: boolean;

  constructor(walletClient: WalletClient, publicClient: PublicClient) {
    this.walletClient = walletClient;
    this.publicClient = publicClient;
    this.isReadOnly = false;
  }

  /** Create a read-only adapter (no signer, can only call view functions) */
  static readOnly(publicClient: PublicClient): ViemAdapter {
    const adapter = Object.create(ViemAdapter.prototype) as ViemAdapter;
    Object.assign(adapter, {
      walletClient: null,
      publicClient,
      isReadOnly: true,
    });
    return adapter;
  }

  async readContract<T = unknown>(params: ReadContractParams): Promise<T> {
    const result = await this.publicClient.readContract({
      address: params.address,
      abi: params.abi as any,
      functionName: params.functionName,
      args: params.args as any,
    });
    return result as T;
  }

  async writeContract(params: WriteContractParams): Promise<Hex> {
    if (!this.walletClient) {
      throw new Error("Cannot write: provider is read-only (no wallet client)");
    }

    const account = this.walletClient.account;
    if (!account) {
      throw new Error("Cannot write: wallet client has no account");
    }

    const { request } = await this.publicClient.simulateContract({
      account,
      address: params.address,
      abi: params.abi as any,
      functionName: params.functionName,
      args: params.args as any,
      value: params.value,
    });

    const hash = await this.walletClient.writeContract(request as any);
    return hash as Hex;
  }

  async waitForTransaction(hash: Hex): Promise<TransactionReceipt> {
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
    return {
      transactionHash: receipt.transactionHash as Hex,
      blockNumber: receipt.blockNumber,
      status: receipt.status,
      logs: receipt.logs,
    };
  }

  watchContractEvent(params: WatchEventParams): () => void {
    const unwatch = this.publicClient.watchContractEvent({
      address: params.address,
      abi: params.abi as any,
      eventName: params.eventName,
      onLogs: params.onLogs as any,
    });
    return unwatch;
  }

  async getAddress(): Promise<Hex> {
    if (!this.walletClient?.account) {
      throw new Error("Cannot get address: provider is read-only");
    }
    return this.walletClient.account.address as Hex;
  }

  async getChainId(): Promise<number> {
    return this.publicClient.getChainId();
  }
}
```

### Step 5: Write the ethers adapter

Create `sdk/packages/sdk/src/adapters/ethers.ts`:
```typescript
import type { Hex } from "@aegis-protocol/types";
import type {
  AegisProvider,
  ReadContractParams,
  WriteContractParams,
  TransactionReceipt,
  WatchEventParams,
} from "../provider";

/**
 * Ethers v6 adapter.
 *
 * Uses dynamic import checking — ethers is an optional peer dependency.
 * We accept the ethers types as `any` to avoid requiring ethers at compile time.
 */
export class EthersAdapter implements AegisProvider {
  private readonly signer: any; // ethers.Signer
  private readonly provider: any; // ethers.Provider

  public readonly isReadOnly: boolean;

  constructor(signer: any, provider?: any) {
    this.signer = signer;
    this.provider = provider ?? signer.provider;
    this.isReadOnly = false;

    if (!this.provider) {
      throw new Error("EthersAdapter: signer has no provider and none was provided");
    }
  }

  static readOnly(provider: any): EthersAdapter {
    const adapter = Object.create(EthersAdapter.prototype) as EthersAdapter;
    Object.assign(adapter, {
      signer: null,
      provider,
      isReadOnly: true,
    });
    return adapter;
  }

  async readContract<T = unknown>(params: ReadContractParams): Promise<T> {
    // Dynamically use ethers.Contract for reads
    const { Contract } = await import("ethers");
    const contract = new Contract(params.address, params.abi as any, this.provider);
    const result = await contract[params.functionName](...(params.args ?? []));
    return result as T;
  }

  async writeContract(params: WriteContractParams): Promise<Hex> {
    if (!this.signer) {
      throw new Error("Cannot write: provider is read-only (no signer)");
    }

    const { Contract } = await import("ethers");
    const contract = new Contract(params.address, params.abi as any, this.signer);
    const tx = await contract[params.functionName](...(params.args ?? []), {
      value: params.value,
    });
    return tx.hash as Hex;
  }

  async waitForTransaction(hash: Hex): Promise<TransactionReceipt> {
    const receipt = await this.provider.waitForTransaction(hash);
    return {
      transactionHash: receipt.hash as Hex,
      blockNumber: BigInt(receipt.blockNumber),
      status: receipt.status === 1 ? "success" : "reverted",
      logs: receipt.logs,
    };
  }

  watchContractEvent(params: WatchEventParams): () => void {
    // ethers uses contract.on(eventName, callback)
    const { Contract } = require("ethers");
    const contract = new Contract(params.address, params.abi as any, this.provider);
    const handler = (...args: any[]) => {
      params.onLogs([args]);
    };
    contract.on(params.eventName, handler);
    return () => {
      contract.off(params.eventName, handler);
    };
  }

  async getAddress(): Promise<Hex> {
    if (!this.signer) {
      throw new Error("Cannot get address: provider is read-only");
    }
    const address = await this.signer.getAddress();
    return address as Hex;
  }

  async getChainId(): Promise<number> {
    const network = await this.provider.getNetwork();
    return Number(network.chainId);
  }
}
```

### Step 6: Write the adapters barrel export

Create `sdk/packages/sdk/src/adapters/index.ts`:
```typescript
export { ViemAdapter } from "./viem";
export { EthersAdapter } from "./ethers";
```

### Step 7: Run tests to verify

Run:
```bash
cd sdk/packages/sdk && pnpm test -- --run src/__tests__/provider.test.ts
```
Expected: PASS — ViemAdapter construction and read-only tests pass.

### Step 8: Commit

```bash
git add sdk/packages/sdk/src/provider.ts sdk/packages/sdk/src/adapters/
git commit -m "feat(sdk): add provider abstraction with viem + ethers adapters

AegisProvider interface with ViemAdapter and EthersAdapter.
Read-only mode supported. ethers is optional peer dep."
```

---

## Task 5: USDC Utility Helpers

**Files:**
- Create: `sdk/packages/sdk/src/utils/usdc.ts`
- Create: `sdk/packages/sdk/src/utils/index.ts`
- Test: `sdk/packages/sdk/src/__tests__/usdc.test.ts`

### Step 1: Write the failing test

Create `sdk/packages/sdk/src/__tests__/usdc.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { parseUSDC, formatUSDC } from "../utils/usdc";

describe("parseUSDC", () => {
  it("converts '10.00' to 10000000n", () => {
    expect(parseUSDC("10.00")).toBe(10_000_000n);
  });

  it("converts '0.01' to 10000n", () => {
    expect(parseUSDC("0.01")).toBe(10_000n);
  });

  it("converts '1000' to 1000000000n", () => {
    expect(parseUSDC("1000")).toBe(1_000_000_000n);
  });

  it("converts '0.000001' to 1n (smallest USDC unit)", () => {
    expect(parseUSDC("0.000001")).toBe(1n);
  });

  it("throws on negative values", () => {
    expect(() => parseUSDC("-1.00")).toThrow();
  });

  it("throws on more than 6 decimals", () => {
    expect(() => parseUSDC("1.0000001")).toThrow();
  });
});

describe("formatUSDC", () => {
  it("converts 10000000n to '10.00'", () => {
    expect(formatUSDC(10_000_000n)).toBe("10.00");
  });

  it("converts 10000n to '0.01'", () => {
    expect(formatUSDC(10_000n)).toBe("0.01");
  });

  it("converts 1n to '0.000001'", () => {
    expect(formatUSDC(1n)).toBe("0.000001");
  });

  it("converts 250000n to '0.25'", () => {
    expect(formatUSDC(250_000n)).toBe("0.25");
  });

  it("converts 0n to '0.00'", () => {
    expect(formatUSDC(0n)).toBe("0.00");
  });
});
```

### Step 2: Run test to verify it fails

Run:
```bash
cd sdk/packages/sdk && pnpm test -- --run src/__tests__/usdc.test.ts
```
Expected: FAIL — `Cannot find module '../utils/usdc'`

### Step 3: Write the USDC helpers

Create `sdk/packages/sdk/src/utils/usdc.ts`:
```typescript
const USDC_DECIMALS = 6;
const USDC_MULTIPLIER = 10n ** BigInt(USDC_DECIMALS);

/**
 * Parse a human-readable USDC amount to its on-chain representation.
 *
 * @example parseUSDC("10.50") → 10500000n
 * @example parseUSDC("0.01") → 10000n
 */
export function parseUSDC(amount: string): bigint {
  if (amount.startsWith("-")) {
    throw new Error(`parseUSDC: negative values not allowed: "${amount}"`);
  }

  const parts = amount.split(".");
  const whole = parts[0] ?? "0";
  const fraction = parts[1] ?? "";

  if (fraction.length > USDC_DECIMALS) {
    throw new Error(
      `parseUSDC: too many decimals (${fraction.length}). USDC has ${USDC_DECIMALS} decimals max.`
    );
  }

  const paddedFraction = fraction.padEnd(USDC_DECIMALS, "0");
  const raw = BigInt(whole) * USDC_MULTIPLIER + BigInt(paddedFraction);
  return raw;
}

/**
 * Format an on-chain USDC amount to a human-readable string.
 * Trims trailing zeros but keeps at least 2 decimal places.
 *
 * @example formatUSDC(10500000n) → "10.50"
 * @example formatUSDC(1n)        → "0.000001"
 */
export function formatUSDC(amount: bigint): string {
  const whole = amount / USDC_MULTIPLIER;
  const fraction = amount % USDC_MULTIPLIER;

  // Pad fraction to 6 digits
  const fractionStr = fraction.toString().padStart(USDC_DECIMALS, "0");

  // Trim trailing zeros but keep at least 2 decimal places
  let trimmed = fractionStr.replace(/0+$/, "");
  if (trimmed.length < 2) {
    trimmed = fractionStr.slice(0, 2);
  }

  return `${whole}.${trimmed}`;
}
```

Create `sdk/packages/sdk/src/utils/index.ts`:
```typescript
export { parseUSDC, formatUSDC } from "./usdc";
```

### Step 4: Run tests to verify they pass

Run:
```bash
cd sdk/packages/sdk && pnpm test -- --run src/__tests__/usdc.test.ts
```
Expected: PASS — all 11 tests pass.

### Step 5: Commit

```bash
git add sdk/packages/sdk/src/utils/ sdk/packages/sdk/src/__tests__/usdc.test.ts
git commit -m "feat(sdk): add parseUSDC / formatUSDC helpers

Prevents the 6-decimal footgun. Full test coverage including
edge cases (smallest unit, zero, negative, overflow)."
```

---

## Task 6: Escrow Service Module

**Files:**
- Create: `sdk/packages/sdk/src/escrow.ts`
- Test: `sdk/packages/sdk/src/__tests__/escrow.test.ts`

### Step 1: Write the failing test for escrow service

Create `sdk/packages/sdk/src/__tests__/escrow.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EscrowService } from "../escrow";
import type { AegisProvider } from "../provider";
import { CHAIN_CONFIGS } from "@aegis-protocol/types";

// Mock provider
function createMockProvider(overrides: Partial<AegisProvider> = {}): AegisProvider {
  return {
    readContract: vi.fn().mockResolvedValue(undefined),
    writeContract: vi.fn().mockResolvedValue("0xdeadbeef" as `0x${string}`),
    waitForTransaction: vi.fn().mockResolvedValue({
      transactionHash: "0xdeadbeef",
      blockNumber: 1n,
      status: "success" as const,
      logs: [],
    }),
    watchContractEvent: vi.fn().mockReturnValue(() => {}),
    getAddress: vi.fn().mockResolvedValue("0x1234567890abcdef1234567890abcdef12345678"),
    getChainId: vi.fn().mockResolvedValue(84532),
    isReadOnly: false,
    ...overrides,
  };
}

const addresses = CHAIN_CONFIGS["base-sepolia"].contracts;

describe("EscrowService", () => {
  let provider: AegisProvider;
  let escrow: EscrowService;

  beforeEach(() => {
    provider = createMockProvider();
    escrow = new EscrowService(provider, addresses);
  });

  describe("createJob", () => {
    it("calls writeContract with correct params", async () => {
      await escrow.createJob({
        clientAgentId: 1n,
        providerAgentId: 2n,
        jobSpecHash: "0xabcd",
        jobSpecURI: "ipfs://test",
        validatorAddress: "0x0000000000000000000000000000000000000001",
        deadline: 1700000000n,
        amount: 10_000_000n,
        validationThreshold: 70,
      });

      expect(provider.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: addresses.escrow,
          functionName: "createJob",
        })
      );
    });
  });

  describe("getJob", () => {
    it("calls readContract with job ID", async () => {
      const mockJob = {
        clientAgentId: 1n,
        providerAgentId: 2n,
        state: 1,
        amount: 10_000_000n,
      };
      (provider.readContract as any).mockResolvedValue(mockJob);

      const job = await escrow.getJob("0xabcd1234");
      expect(provider.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: addresses.escrow,
          functionName: "getJob",
          args: ["0xabcd1234"],
        })
      );
    });
  });

  describe("getAgentJobs", () => {
    it("calls readContract with agent ID", async () => {
      (provider.readContract as any).mockResolvedValue(["0xjob1", "0xjob2"]);

      const jobs = await escrow.getAgentJobs(1n);
      expect(provider.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: addresses.escrow,
          functionName: "getAgentJobIds",
          args: [1n],
        })
      );
    });
  });

  describe("read-only guard", () => {
    it("throws when calling write methods on read-only provider", async () => {
      const readOnlyProvider = createMockProvider({ isReadOnly: true });
      const readOnlyEscrow = new EscrowService(readOnlyProvider, addresses);

      await expect(
        readOnlyEscrow.createJob({
          clientAgentId: 1n,
          providerAgentId: 2n,
          jobSpecHash: "0xabcd",
          jobSpecURI: "ipfs://test",
          validatorAddress: "0x0000000000000000000000000000000000000001",
          deadline: 1700000000n,
          amount: 10_000_000n,
          validationThreshold: 70,
        })
      ).rejects.toThrow("read-only");
    });
  });
});
```

### Step 2: Run test to verify it fails

Run:
```bash
cd sdk/packages/sdk && pnpm test -- --run src/__tests__/escrow.test.ts
```
Expected: FAIL — `Cannot find module '../escrow'`

### Step 3: Write the escrow service module

Create `sdk/packages/sdk/src/escrow.ts`:
```typescript
import type { Hex, Job, ContractAddresses } from "@aegis-protocol/types";
import { AegisValidationError } from "@aegis-protocol/types";
import { aegisEscrowAbi } from "@aegis-protocol/abis";
import type { AegisProvider } from "./provider";

/** Parameters for creating a new escrow job */
export interface CreateJobParams {
  clientAgentId: bigint;
  providerAgentId: bigint;
  jobSpecHash: Hex;
  jobSpecURI: string;
  validatorAddress: Hex;
  deadline: bigint;
  amount: bigint;
  validationThreshold: number;
}

/** Parameters for submitting a deliverable */
export interface SubmitDeliverableParams {
  deliverableURI: string;
  deliverableHash: Hex;
}

/**
 * EscrowService — wraps AegisEscrow.sol.
 *
 * Handles job creation, deliverable submission, validation processing,
 * client confirmation, dispute window settlement, and timeout claims.
 */
export class EscrowService {
  private readonly provider: AegisProvider;
  private readonly address: Hex;
  private readonly addresses: ContractAddresses;

  constructor(provider: AegisProvider, addresses: ContractAddresses) {
    this.provider = provider;
    this.address = addresses.escrow;
    this.addresses = addresses;
  }

  // ── Write Methods ──────────────────────────────────────────────

  /** Create a new escrow job (atomically locks USDC) */
  async createJob(params: CreateJobParams): Promise<Hex> {
    this.requireSigner("createJob");

    const hash = await this.provider.writeContract({
      address: this.address,
      abi: aegisEscrowAbi,
      functionName: "createJob",
      args: [
        params.clientAgentId,
        params.providerAgentId,
        params.jobSpecHash,
        params.jobSpecURI,
        params.validatorAddress,
        params.deadline,
        params.amount,
        params.validationThreshold,
      ],
    });

    return hash;
  }

  /** Submit a deliverable for a funded job (provider only) */
  async submitDeliverable(jobId: Hex, params: SubmitDeliverableParams): Promise<Hex> {
    this.requireSigner("submitDeliverable");

    return this.provider.writeContract({
      address: this.address,
      abi: aegisEscrowAbi,
      functionName: "submitDeliverable",
      args: [jobId, params.deliverableURI, params.deliverableHash],
    });
  }

  /** Process on-chain validation result (permissionless) */
  async processValidation(jobId: Hex): Promise<Hex> {
    this.requireSigner("processValidation");

    return this.provider.writeContract({
      address: this.address,
      abi: aegisEscrowAbi,
      functionName: "processValidation",
      args: [jobId],
    });
  }

  /** Client confirms delivery (bypasses validation, settles immediately) */
  async confirmDelivery(jobId: Hex): Promise<Hex> {
    this.requireSigner("confirmDelivery");

    return this.provider.writeContract({
      address: this.address,
      abi: aegisEscrowAbi,
      functionName: "confirmDelivery",
      args: [jobId],
    });
  }

  /** Settle job after dispute window expires without dispute */
  async settleAfterDisputeWindow(jobId: Hex): Promise<Hex> {
    this.requireSigner("settleAfterDisputeWindow");

    return this.provider.writeContract({
      address: this.address,
      abi: aegisEscrowAbi,
      functionName: "settleAfterDisputeWindow",
      args: [jobId],
    });
  }

  /** Raise a dispute during dispute window (client or provider) */
  async raiseDispute(
    jobId: Hex,
    evidenceURI: string,
    evidenceHash: Hex
  ): Promise<Hex> {
    this.requireSigner("raiseDispute");

    return this.provider.writeContract({
      address: this.address,
      abi: aegisEscrowAbi,
      functionName: "raiseDispute",
      args: [jobId, evidenceURI, evidenceHash],
    });
  }

  /** Claim timeout refund for an expired funded job (client only) */
  async claimTimeout(jobId: Hex): Promise<Hex> {
    this.requireSigner("claimTimeout");

    return this.provider.writeContract({
      address: this.address,
      abi: aegisEscrowAbi,
      functionName: "claimTimeout",
      args: [jobId],
    });
  }

  // ── Read Methods ───────────────────────────────────────────────

  /** Get full job details */
  async getJob(jobId: Hex): Promise<Job> {
    return this.provider.readContract<Job>({
      address: this.address,
      abi: aegisEscrowAbi,
      functionName: "getJob",
      args: [jobId],
    });
  }

  /** Get all job IDs for an agent */
  async getAgentJobs(agentId: bigint): Promise<readonly Hex[]> {
    return this.provider.readContract<readonly Hex[]>({
      address: this.address,
      abi: aegisEscrowAbi,
      functionName: "getAgentJobIds",
      args: [agentId],
    });
  }

  /** Get job count for an agent */
  async getAgentJobCount(agentId: bigint): Promise<bigint> {
    return this.provider.readContract<bigint>({
      address: this.address,
      abi: aegisEscrowAbi,
      functionName: "getAgentJobCount",
      args: [agentId],
    });
  }

  /** Check if a job exists */
  async jobExists(jobId: Hex): Promise<boolean> {
    return this.provider.readContract<boolean>({
      address: this.address,
      abi: aegisEscrowAbi,
      functionName: "jobExists",
      args: [jobId],
    });
  }

  /** Get protocol-level statistics */
  async getProtocolStats(): Promise<{
    totalJobsCreated: bigint;
    totalVolumeSettled: bigint;
  }> {
    const [totalJobsCreated, totalVolumeSettled] = await Promise.all([
      this.provider.readContract<bigint>({
        address: this.address,
        abi: aegisEscrowAbi,
        functionName: "totalJobsCreated",
      }),
      this.provider.readContract<bigint>({
        address: this.address,
        abi: aegisEscrowAbi,
        functionName: "totalVolumeSettled",
      }),
    ]);
    return { totalJobsCreated, totalVolumeSettled };
  }

  // ── Event Listeners ────────────────────────────────────────────

  /** Watch for new job creation events */
  onJobCreated(callback: (event: any) => void): () => void {
    return this.provider.watchContractEvent({
      address: this.address,
      abi: aegisEscrowAbi,
      eventName: "JobCreated",
      onLogs: (logs) => logs.forEach(callback),
    });
  }

  /** Watch for job settlement events */
  onJobSettled(callback: (event: any) => void): () => void {
    return this.provider.watchContractEvent({
      address: this.address,
      abi: aegisEscrowAbi,
      eventName: "JobSettled",
      onLogs: (logs) => logs.forEach(callback),
    });
  }

  /** Watch for deliverable submission events */
  onDeliverableSubmitted(callback: (event: any) => void): () => void {
    return this.provider.watchContractEvent({
      address: this.address,
      abi: aegisEscrowAbi,
      eventName: "DeliverableSubmitted",
      onLogs: (logs) => logs.forEach(callback),
    });
  }

  // ── Internal ───────────────────────────────────────────────────

  private requireSigner(method: string): void {
    if (this.provider.isReadOnly) {
      throw new AegisValidationError(
        `Cannot call ${method}: provider is read-only. Use AegisClient.fromViem() or AegisClient.fromEthers() with a signer.`
      );
    }
  }
}
```

### Step 4: Run tests to verify

Run:
```bash
cd sdk/packages/sdk && pnpm test -- --run src/__tests__/escrow.test.ts
```
Expected: PASS — all 4 test groups pass.

### Step 5: Commit

```bash
git add sdk/packages/sdk/src/escrow.ts sdk/packages/sdk/src/__tests__/escrow.test.ts
git commit -m "feat(sdk): add EscrowService module

Full coverage of AegisEscrow.sol: createJob, submitDeliverable,
processValidation, confirmDelivery, settleAfterDisputeWindow,
raiseDispute, claimTimeout + all view functions + event listeners.
Read-only guard prevents write calls without a signer."
```

---

## Task 7: Dispute Service Module

**Files:**
- Create: `sdk/packages/sdk/src/dispute.ts`
- Test: `sdk/packages/sdk/src/__tests__/dispute.test.ts`

### Step 1: Write the failing test

Create `sdk/packages/sdk/src/__tests__/dispute.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DisputeService } from "../dispute";
import type { AegisProvider } from "../provider";
import { CHAIN_CONFIGS } from "@aegis-protocol/types";

function createMockProvider(overrides: Partial<AegisProvider> = {}): AegisProvider {
  return {
    readContract: vi.fn().mockResolvedValue(undefined),
    writeContract: vi.fn().mockResolvedValue("0xdeadbeef" as `0x${string}`),
    waitForTransaction: vi.fn().mockResolvedValue({
      transactionHash: "0xdeadbeef",
      blockNumber: 1n,
      status: "success" as const,
      logs: [],
    }),
    watchContractEvent: vi.fn().mockReturnValue(() => {}),
    getAddress: vi.fn().mockResolvedValue("0x1234567890abcdef1234567890abcdef12345678"),
    getChainId: vi.fn().mockResolvedValue(84532),
    isReadOnly: false,
    ...overrides,
  };
}

const addresses = CHAIN_CONFIGS["base-sepolia"].contracts;

describe("DisputeService", () => {
  let provider: AegisProvider;
  let dispute: DisputeService;

  beforeEach(() => {
    provider = createMockProvider();
    dispute = new DisputeService(provider, addresses);
  });

  describe("stakeAsArbitrator", () => {
    it("calls writeContract with amount", async () => {
      await dispute.stakeAsArbitrator(1_000_000_000n);

      expect(provider.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: addresses.dispute,
          functionName: "stakeAsArbitrator",
          args: [1_000_000_000n],
        })
      );
    });
  });

  describe("getDispute", () => {
    it("calls readContract with dispute ID", async () => {
      await dispute.getDispute("0xdispute123");
      expect(provider.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: addresses.dispute,
          functionName: "getDispute",
          args: ["0xdispute123"],
        })
      );
    });
  });

  describe("getActiveArbitratorCount", () => {
    it("reads arbitrator count", async () => {
      (provider.readContract as any).mockResolvedValue(5n);
      const count = await dispute.getActiveArbitratorCount();
      expect(count).toBe(5n);
    });
  });
});
```

### Step 2: Run test to verify it fails

Run:
```bash
cd sdk/packages/sdk && pnpm test -- --run src/__tests__/dispute.test.ts
```
Expected: FAIL — `Cannot find module '../dispute'`

### Step 3: Write the dispute service module

Create `sdk/packages/sdk/src/dispute.ts`:
```typescript
import type { Hex, Dispute, ArbitratorStats, ContractAddresses } from "@aegis-protocol/types";
import { AegisValidationError } from "@aegis-protocol/types";
import { aegisDisputeAbi } from "@aegis-protocol/abis";
import type { AegisProvider } from "./provider";

/** Parameters for resolving a dispute by arbitrator */
export interface ResolveByArbitratorParams {
  clientPercent: number;
  rationaleURI: string;
  rationaleHash: Hex;
}

/**
 * DisputeService — wraps AegisDispute.sol.
 *
 * Handles the 3-tier dispute resolution: re-validation, arbitrator, timeout.
 * Also manages arbitrator staking/unstaking.
 */
export class DisputeService {
  private readonly provider: AegisProvider;
  private readonly address: Hex;

  constructor(provider: AegisProvider, addresses: ContractAddresses) {
    this.provider = provider;
    this.address = addresses.dispute;
  }

  // ── Arbitrator Staking ─────────────────────────────────────────

  /** Stake USDC to become an arbitrator */
  async stakeAsArbitrator(amount: bigint): Promise<Hex> {
    this.requireSigner("stakeAsArbitrator");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisDisputeAbi,
      functionName: "stakeAsArbitrator",
      args: [amount],
    });
  }

  /** Unstake USDC (partial or full withdrawal) */
  async unstakeArbitrator(amount: bigint): Promise<Hex> {
    this.requireSigner("unstakeArbitrator");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisDisputeAbi,
      functionName: "unstakeArbitrator",
      args: [amount],
    });
  }

  // ── Dispute Lifecycle ──────────────────────────────────────────

  /** Submit evidence for a dispute (respondent) */
  async submitEvidence(
    disputeId: Hex,
    evidenceURI: string,
    evidenceHash: Hex
  ): Promise<Hex> {
    this.requireSigner("submitEvidence");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisDisputeAbi,
      functionName: "submitEvidence",
      args: [disputeId, evidenceURI, evidenceHash],
    });
  }

  /** Assign a random arbitrator to a dispute */
  async assignArbitrator(disputeId: Hex): Promise<Hex> {
    this.requireSigner("assignArbitrator");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisDisputeAbi,
      functionName: "assignArbitrator",
      args: [disputeId],
    });
  }

  /** Resolve a dispute as the assigned arbitrator */
  async resolveByArbitrator(
    disputeId: Hex,
    params: ResolveByArbitratorParams
  ): Promise<Hex> {
    this.requireSigner("resolveByArbitrator");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisDisputeAbi,
      functionName: "resolveByArbitrator",
      args: [disputeId, params.clientPercent, params.rationaleURI, params.rationaleHash],
    });
  }

  /** Resolve a dispute by timeout (when TTL expires without resolution) */
  async resolveByTimeout(disputeId: Hex): Promise<Hex> {
    this.requireSigner("resolveByTimeout");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisDisputeAbi,
      functionName: "resolveByTimeout",
      args: [disputeId],
    });
  }

  // ── Read Methods ───────────────────────────────────────────────

  /** Get full dispute details */
  async getDispute(disputeId: Hex): Promise<Dispute> {
    return this.provider.readContract<Dispute>({
      address: this.address,
      abi: aegisDisputeAbi,
      functionName: "getDispute",
      args: [disputeId],
    });
  }

  /** Get dispute ID for a job */
  async getDisputeForJob(jobId: Hex): Promise<Hex> {
    return this.provider.readContract<Hex>({
      address: this.address,
      abi: aegisDisputeAbi,
      functionName: "getDisputeForJob",
      args: [jobId],
    });
  }

  /** Get count of active (staked) arbitrators */
  async getActiveArbitratorCount(): Promise<bigint> {
    return this.provider.readContract<bigint>({
      address: this.address,
      abi: aegisDisputeAbi,
      functionName: "getActiveArbitratorCount",
    });
  }

  /** Get stats for a specific arbitrator */
  async getArbitratorStats(arbitratorAddress: Hex): Promise<ArbitratorStats> {
    return this.provider.readContract<ArbitratorStats>({
      address: this.address,
      abi: aegisDisputeAbi,
      functionName: "getArbitratorStats",
      args: [arbitratorAddress],
    });
  }

  // ── Event Listeners ────────────────────────────────────────────

  /** Watch for dispute resolution events */
  onDisputeResolved(callback: (event: any) => void): () => void {
    return this.provider.watchContractEvent({
      address: this.address,
      abi: aegisDisputeAbi,
      eventName: "DisputeResolved",
      onLogs: (logs) => logs.forEach(callback),
    });
  }

  /** Watch for arbitrator assignment events */
  onArbitratorAssigned(callback: (event: any) => void): () => void {
    return this.provider.watchContractEvent({
      address: this.address,
      abi: aegisDisputeAbi,
      eventName: "ArbitratorAssigned",
      onLogs: (logs) => logs.forEach(callback),
    });
  }

  // ── Internal ───────────────────────────────────────────────────

  private requireSigner(method: string): void {
    if (this.provider.isReadOnly) {
      throw new AegisValidationError(
        `Cannot call ${method}: provider is read-only.`
      );
    }
  }
}
```

### Step 4: Run tests to verify

Run:
```bash
cd sdk/packages/sdk && pnpm test -- --run src/__tests__/dispute.test.ts
```
Expected: PASS — all 3 test groups pass.

### Step 5: Commit

```bash
git add sdk/packages/sdk/src/dispute.ts sdk/packages/sdk/src/__tests__/dispute.test.ts
git commit -m "feat(sdk): add DisputeService module

3-tier dispute resolution: re-validation, arbitrator, timeout.
Arbitrator staking/unstaking. View functions + event listeners."
```

---

## Task 8: Treasury + Factory Service Modules

**Files:**
- Create: `sdk/packages/sdk/src/treasury.ts`
- Create: `sdk/packages/sdk/src/factory.ts`
- Test: `sdk/packages/sdk/src/__tests__/treasury.test.ts`
- Test: `sdk/packages/sdk/src/__tests__/factory.test.ts`

### Step 1: Write failing tests for both modules

Create `sdk/packages/sdk/src/__tests__/treasury.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TreasuryService } from "../treasury";
import type { AegisProvider } from "../provider";
import { CHAIN_CONFIGS } from "@aegis-protocol/types";

function createMockProvider(): AegisProvider {
  return {
    readContract: vi.fn().mockResolvedValue(undefined),
    writeContract: vi.fn().mockResolvedValue("0xdeadbeef" as `0x${string}`),
    waitForTransaction: vi.fn().mockResolvedValue({
      transactionHash: "0xdeadbeef", blockNumber: 1n, status: "success" as const, logs: [],
    }),
    watchContractEvent: vi.fn().mockReturnValue(() => {}),
    getAddress: vi.fn().mockResolvedValue("0x1234567890abcdef1234567890abcdef12345678"),
    getChainId: vi.fn().mockResolvedValue(84532),
    isReadOnly: false,
  };
}

describe("TreasuryService", () => {
  let provider: AegisProvider;
  let treasury: TreasuryService;

  beforeEach(() => {
    provider = createMockProvider();
    treasury = new TreasuryService(provider, CHAIN_CONFIGS["base-sepolia"].contracts);
  });

  it("reads total balance", async () => {
    (provider.readContract as any).mockResolvedValue(1_000_000n);
    const balance = await treasury.totalBalance();
    expect(balance).toBe(1_000_000n);
  });

  it("withdraws treasury funds", async () => {
    await treasury.withdrawTreasury("0xrecipient" as any, 500_000n);
    expect(provider.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "withdrawTreasury",
        args: ["0xrecipient", 500_000n],
      })
    );
  });
});
```

Create `sdk/packages/sdk/src/__tests__/factory.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FactoryService } from "../factory";
import type { AegisProvider } from "../provider";
import { CHAIN_CONFIGS } from "@aegis-protocol/types";

function createMockProvider(): AegisProvider {
  return {
    readContract: vi.fn().mockResolvedValue(undefined),
    writeContract: vi.fn().mockResolvedValue("0xdeadbeef" as `0x${string}`),
    waitForTransaction: vi.fn().mockResolvedValue({
      transactionHash: "0xdeadbeef", blockNumber: 1n, status: "success" as const, logs: [],
    }),
    watchContractEvent: vi.fn().mockReturnValue(() => {}),
    getAddress: vi.fn().mockResolvedValue("0x1234567890abcdef1234567890abcdef12345678"),
    getChainId: vi.fn().mockResolvedValue(84532),
    isReadOnly: false,
  };
}

describe("FactoryService", () => {
  let provider: AegisProvider;
  let factory: FactoryService;

  beforeEach(() => {
    provider = createMockProvider();
    factory = new FactoryService(provider, CHAIN_CONFIGS["base-sepolia"].contracts);
  });

  it("creates a template", async () => {
    await factory.createTemplate({
      name: "code-review",
      defaultValidator: "0x0000000000000000000000000000000000000001",
      defaultTimeout: 604800n,
      feeBps: 250n,
      minValidation: 70,
      defaultDisputeSplit: 50,
    });

    expect(provider.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "createTemplate",
      })
    );
  });

  it("reads a template", async () => {
    const mockTemplate = { name: "code-review", active: true };
    (provider.readContract as any).mockResolvedValue(mockTemplate);

    const template = await factory.getTemplate(1n);
    expect(provider.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "getTemplate",
        args: [1n],
      })
    );
  });
});
```

### Step 2: Run tests to verify they fail

Run:
```bash
cd sdk/packages/sdk && pnpm test -- --run src/__tests__/treasury.test.ts src/__tests__/factory.test.ts
```
Expected: FAIL — modules not found.

### Step 3: Write the treasury service

Create `sdk/packages/sdk/src/treasury.ts`:
```typescript
import type { Hex, ContractAddresses } from "@aegis-protocol/types";
import { AegisValidationError } from "@aegis-protocol/types";
import { aegisTreasuryAbi } from "@aegis-protocol/abis";
import type { AegisProvider } from "./provider";

/**
 * TreasuryService — wraps AegisTreasury.sol.
 *
 * Admin operations for fee collection, treasury withdrawal,
 * and arbitrator reward distribution.
 */
export class TreasuryService {
  private readonly provider: AegisProvider;
  private readonly address: Hex;

  constructor(provider: AegisProvider, addresses: ContractAddresses) {
    this.provider = provider;
    this.address = addresses.treasury;
  }

  // ── Read Methods ───────────────────────────────────────────────

  /** Get total USDC balance held by the treasury */
  async totalBalance(): Promise<bigint> {
    return this.provider.readContract<bigint>({
      address: this.address,
      abi: aegisTreasuryAbi,
      functionName: "totalBalance",
    });
  }

  /** Get breakdown of treasury vs arbitrator pool balances */
  async getBalances(): Promise<{
    totalFeesCollected: bigint;
    treasuryBalance: bigint;
    arbitratorPoolBalance: bigint;
  }> {
    const [totalFeesCollected, treasuryBalance, arbitratorPoolBalance] =
      await Promise.all([
        this.provider.readContract<bigint>({
          address: this.address,
          abi: aegisTreasuryAbi,
          functionName: "totalFeesCollected",
        }),
        this.provider.readContract<bigint>({
          address: this.address,
          abi: aegisTreasuryAbi,
          functionName: "treasuryBalance",
        }),
        this.provider.readContract<bigint>({
          address: this.address,
          abi: aegisTreasuryAbi,
          functionName: "arbitratorPoolBalance",
        }),
      ]);
    return { totalFeesCollected, treasuryBalance, arbitratorPoolBalance };
  }

  // ── Write Methods (admin only) ─────────────────────────────────

  /** Withdraw USDC from treasury (owner only) */
  async withdrawTreasury(to: Hex, amount: bigint): Promise<Hex> {
    this.requireSigner("withdrawTreasury");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisTreasuryAbi,
      functionName: "withdrawTreasury",
      args: [to, amount],
    });
  }

  /** Distribute arbitrator pool rewards (owner only) */
  async distributeArbitratorRewards(
    disputeContract: Hex,
    amount: bigint
  ): Promise<Hex> {
    this.requireSigner("distributeArbitratorRewards");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisTreasuryAbi,
      functionName: "distributeArbitratorRewards",
      args: [disputeContract, amount],
    });
  }

  /** Sync tracked balances with actual USDC balance (owner only) */
  async sweep(): Promise<Hex> {
    this.requireSigner("sweep");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisTreasuryAbi,
      functionName: "sweep",
    });
  }

  // ── Internal ───────────────────────────────────────────────────

  private requireSigner(method: string): void {
    if (this.provider.isReadOnly) {
      throw new AegisValidationError(
        `Cannot call ${method}: provider is read-only.`
      );
    }
  }
}
```

### Step 4: Write the factory service

Create `sdk/packages/sdk/src/factory.ts`:
```typescript
import type { Hex, JobTemplate, ContractAddresses } from "@aegis-protocol/types";
import { AegisValidationError } from "@aegis-protocol/types";
import { aegisJobFactoryAbi } from "@aegis-protocol/abis";
import type { AegisProvider } from "./provider";

/** Parameters for creating a job template */
export interface CreateTemplateParams {
  name: string;
  defaultValidator: Hex;
  defaultTimeout: bigint;
  feeBps: bigint;
  minValidation: number;
  defaultDisputeSplit: number;
}

/** Parameters for creating a job from a template */
export interface CreateJobFromTemplateParams {
  templateId: bigint;
  clientAgentId: bigint;
  providerAgentId: bigint;
  jobSpecHash: Hex;
  jobSpecURI: string;
  amount: bigint;
}

/**
 * FactoryService — wraps AegisJobFactory.sol.
 *
 * Manages standardized job templates and creates jobs from them.
 */
export class FactoryService {
  private readonly provider: AegisProvider;
  private readonly address: Hex;

  constructor(provider: AegisProvider, addresses: ContractAddresses) {
    this.provider = provider;
    this.address = addresses.factory;
  }

  // ── Write Methods ──────────────────────────────────────────────

  /** Create a new job template */
  async createTemplate(params: CreateTemplateParams): Promise<Hex> {
    this.requireSigner("createTemplate");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisJobFactoryAbi,
      functionName: "createTemplate",
      args: [
        params.name,
        params.defaultValidator,
        params.defaultTimeout,
        params.feeBps,
        params.minValidation,
        params.defaultDisputeSplit,
      ],
    });
  }

  /** Create a job from an existing template */
  async createJobFromTemplate(params: CreateJobFromTemplateParams): Promise<Hex> {
    this.requireSigner("createJobFromTemplate");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisJobFactoryAbi,
      functionName: "createJobFromTemplate",
      args: [
        params.templateId,
        params.clientAgentId,
        params.providerAgentId,
        params.jobSpecHash,
        params.jobSpecURI,
        params.amount,
      ],
    });
  }

  /** Deactivate a template (creator only) */
  async deactivateTemplate(templateId: bigint): Promise<Hex> {
    this.requireSigner("deactivateTemplate");
    return this.provider.writeContract({
      address: this.address,
      abi: aegisJobFactoryAbi,
      functionName: "deactivateTemplate",
      args: [templateId],
    });
  }

  // ── Read Methods ───────────────────────────────────────────────

  /** Get a template by ID */
  async getTemplate(templateId: bigint): Promise<JobTemplate> {
    return this.provider.readContract<JobTemplate>({
      address: this.address,
      abi: aegisJobFactoryAbi,
      functionName: "getTemplate",
      args: [templateId],
    });
  }

  /** Check if a template is active */
  async isTemplateActive(templateId: bigint): Promise<boolean> {
    return this.provider.readContract<boolean>({
      address: this.address,
      abi: aegisJobFactoryAbi,
      functionName: "isTemplateActive",
      args: [templateId],
    });
  }

  // ── Internal ───────────────────────────────────────────────────

  private requireSigner(method: string): void {
    if (this.provider.isReadOnly) {
      throw new AegisValidationError(
        `Cannot call ${method}: provider is read-only.`
      );
    }
  }
}
```

### Step 5: Run tests to verify

Run:
```bash
cd sdk/packages/sdk && pnpm test -- --run src/__tests__/treasury.test.ts src/__tests__/factory.test.ts
```
Expected: PASS — all tests pass.

### Step 6: Commit

```bash
git add sdk/packages/sdk/src/treasury.ts sdk/packages/sdk/src/factory.ts \
       sdk/packages/sdk/src/__tests__/treasury.test.ts sdk/packages/sdk/src/__tests__/factory.test.ts
git commit -m "feat(sdk): add TreasuryService + FactoryService modules

Treasury: balance reads, withdrawals, arbitrator reward distribution.
Factory: template CRUD, createJobFromTemplate."
```

---

## Task 9: ERC-8004 Registry Wrappers

**Files:**
- Create: `sdk/packages/sdk/src/erc8004/identity.ts`
- Create: `sdk/packages/sdk/src/erc8004/reputation.ts`
- Create: `sdk/packages/sdk/src/erc8004/validation.ts`
- Create: `sdk/packages/sdk/src/erc8004/index.ts`
- Test: `sdk/packages/sdk/src/__tests__/erc8004.test.ts`

### Step 1: Write the failing test

Create `sdk/packages/sdk/src/__tests__/erc8004.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { IdentityService } from "../erc8004/identity";
import { ReputationService } from "../erc8004/reputation";
import { ValidationService } from "../erc8004/validation";
import type { AegisProvider } from "../provider";
import { CHAIN_CONFIGS } from "@aegis-protocol/types";

function createMockProvider(): AegisProvider {
  return {
    readContract: vi.fn().mockResolvedValue(undefined),
    writeContract: vi.fn().mockResolvedValue("0xdeadbeef" as `0x${string}`),
    waitForTransaction: vi.fn().mockResolvedValue({
      transactionHash: "0xdeadbeef", blockNumber: 1n, status: "success" as const, logs: [],
    }),
    watchContractEvent: vi.fn().mockReturnValue(() => {}),
    getAddress: vi.fn().mockResolvedValue("0x1234567890abcdef1234567890abcdef12345678"),
    getChainId: vi.fn().mockResolvedValue(84532),
    isReadOnly: false,
  };
}

const addresses = CHAIN_CONFIGS["base-sepolia"].contracts;

describe("IdentityService", () => {
  it("registers an agent", async () => {
    const provider = createMockProvider();
    const identity = new IdentityService(provider, addresses);
    await identity.register("agent://my-agent");
    expect(provider.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "register" })
    );
  });

  it("gets agent wallet", async () => {
    const provider = createMockProvider();
    (provider.readContract as any).mockResolvedValue("0xwallet");
    const identity = new IdentityService(provider, addresses);
    const wallet = await identity.getAgentWallet(1n);
    expect(provider.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getAgentWallet", args: [1n] })
    );
  });
});

describe("ReputationService", () => {
  it("gets summary", async () => {
    const provider = createMockProvider();
    (provider.readContract as any).mockResolvedValue({ count: 10n, summaryValue: 85n });
    const reputation = new ReputationService(provider, addresses);
    await reputation.getSummary(1n, ["0xclient1" as any]);
    expect(provider.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getSummary" })
    );
  });
});

describe("ValidationService", () => {
  it("gets validation status", async () => {
    const provider = createMockProvider();
    const validation = new ValidationService(provider, addresses);
    await validation.getValidationStatus("0xhash123");
    expect(provider.readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getValidationStatus", args: ["0xhash123"] })
    );
  });
});
```

### Step 2: Run tests to verify they fail

Run:
```bash
cd sdk/packages/sdk && pnpm test -- --run src/__tests__/erc8004.test.ts
```
Expected: FAIL — modules not found.

### Step 3: Write the ERC-8004 wrappers

Create `sdk/packages/sdk/src/erc8004/identity.ts`:
```typescript
import type { Hex, ContractAddresses } from "@aegis-protocol/types";
import { AegisValidationError } from "@aegis-protocol/types";
import { erc8004IdentityAbi } from "@aegis-protocol/abis";
import type { AegisProvider } from "../provider";

/**
 * IdentityService — wraps IERC8004Identity (MockIdentityRegistry on testnet).
 */
export class IdentityService {
  private readonly provider: AegisProvider;
  private readonly address: Hex;

  constructor(provider: AegisProvider, addresses: ContractAddresses) {
    this.provider = provider;
    this.address = addresses.identityRegistry;
  }

  /** Register a new agent and get its ID */
  async register(agentURI: string): Promise<Hex> {
    if (this.provider.isReadOnly) {
      throw new AegisValidationError("Cannot register: provider is read-only.");
    }
    return this.provider.writeContract({
      address: this.address,
      abi: erc8004IdentityAbi,
      functionName: "register",
      args: [agentURI],
    });
  }

  /** Get the payment wallet for an agent */
  async getAgentWallet(agentId: bigint): Promise<Hex> {
    return this.provider.readContract<Hex>({
      address: this.address,
      abi: erc8004IdentityAbi,
      functionName: "getAgentWallet",
      args: [agentId],
    });
  }

  /** Get the owner address of an agent */
  async ownerOf(agentId: bigint): Promise<Hex> {
    return this.provider.readContract<Hex>({
      address: this.address,
      abi: erc8004IdentityAbi,
      functionName: "ownerOf",
      args: [agentId],
    });
  }
}
```

Create `sdk/packages/sdk/src/erc8004/reputation.ts`:
```typescript
import type { Hex, ContractAddresses } from "@aegis-protocol/types";
import { erc8004ReputationAbi } from "@aegis-protocol/abis";
import type { AegisProvider } from "../provider";

/** Reputation summary returned from getSummary */
export interface ReputationSummary {
  count: bigint;
  summaryValue: bigint;
  summaryValueDecimals: number;
}

/**
 * ReputationService — wraps IERC8004Reputation (MockReputationRegistry on testnet).
 */
export class ReputationService {
  private readonly provider: AegisProvider;
  private readonly address: Hex;

  constructor(provider: AegisProvider, addresses: ContractAddresses) {
    this.provider = provider;
    this.address = addresses.reputationRegistry;
  }

  /** Get aggregated reputation summary for an agent */
  async getSummary(
    agentId: bigint,
    clientAddresses: readonly Hex[],
    tag1 = "",
    tag2 = ""
  ): Promise<ReputationSummary> {
    return this.provider.readContract<ReputationSummary>({
      address: this.address,
      abi: erc8004ReputationAbi,
      functionName: "getSummary",
      args: [agentId, clientAddresses, tag1, tag2],
    });
  }

  /** Get list of client addresses that have given feedback to an agent */
  async getClients(agentId: bigint): Promise<readonly Hex[]> {
    return this.provider.readContract<readonly Hex[]>({
      address: this.address,
      abi: erc8004ReputationAbi,
      functionName: "getClients",
      args: [agentId],
    });
  }
}
```

Create `sdk/packages/sdk/src/erc8004/validation.ts`:
```typescript
import type { Hex, ContractAddresses } from "@aegis-protocol/types";
import { erc8004ValidationAbi } from "@aegis-protocol/abis";
import type { AegisProvider } from "../provider";

/** Validation status returned from getValidationStatus */
export interface ValidationStatus {
  validatorAddress: Hex;
  agentId: bigint;
  response: number;
  responseHash: Hex;
  tag: string;
  lastUpdate: bigint;
}

/**
 * ValidationService — wraps IERC8004Validation (MockValidationRegistry on testnet).
 */
export class ValidationService {
  private readonly provider: AegisProvider;
  private readonly address: Hex;

  constructor(provider: AegisProvider, addresses: ContractAddresses) {
    this.provider = provider;
    this.address = addresses.validationRegistry;
  }

  /** Get the validation status for a request hash */
  async getValidationStatus(requestHash: Hex): Promise<ValidationStatus> {
    return this.provider.readContract<ValidationStatus>({
      address: this.address,
      abi: erc8004ValidationAbi,
      functionName: "getValidationStatus",
      args: [requestHash],
    });
  }

  /** Get all validation request hashes for an agent */
  async getAgentValidations(agentId: bigint): Promise<readonly Hex[]> {
    return this.provider.readContract<readonly Hex[]>({
      address: this.address,
      abi: erc8004ValidationAbi,
      functionName: "getAgentValidations",
      args: [agentId],
    });
  }
}
```

Create `sdk/packages/sdk/src/erc8004/index.ts`:
```typescript
export { IdentityService } from "./identity";
export { ReputationService, type ReputationSummary } from "./reputation";
export { ValidationService, type ValidationStatus } from "./validation";
```

### Step 4: Run tests to verify

Run:
```bash
cd sdk/packages/sdk && pnpm test -- --run src/__tests__/erc8004.test.ts
```
Expected: PASS — all tests pass.

### Step 5: Commit

```bash
git add sdk/packages/sdk/src/erc8004/
git commit -m "feat(sdk): add ERC-8004 registry wrappers

Identity (register, getAgentWallet, ownerOf),
Reputation (getSummary, getClients),
Validation (getValidationStatus, getAgentValidations)."
```

---

## Task 10: Unified AegisClient + Public API

**Files:**
- Create: `sdk/packages/sdk/src/client.ts`
- Create: `sdk/packages/sdk/src/index.ts`
- Test: `sdk/packages/sdk/src/__tests__/client.test.ts`

### Step 1: Write the failing test

Create `sdk/packages/sdk/src/__tests__/client.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { AegisClient } from "../client";
import { createPublicClient, createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

describe("AegisClient", () => {
  describe("fromViem", () => {
    it("creates a client with all service modules", () => {
      const account = privateKeyToAccount(TEST_KEY);
      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(),
      });
      const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(),
      });

      const aegis = AegisClient.fromViem({
        walletClient,
        publicClient,
        chain: "base-sepolia",
      });

      expect(aegis.escrow).toBeDefined();
      expect(aegis.dispute).toBeDefined();
      expect(aegis.treasury).toBeDefined();
      expect(aegis.factory).toBeDefined();
      expect(aegis.identity).toBeDefined();
      expect(aegis.reputation).toBeDefined();
      expect(aegis.validation).toBeDefined();
    });
  });

  describe("readOnly", () => {
    it("creates a read-only client", () => {
      const aegis = AegisClient.readOnly({
        rpcUrl: "https://sepolia.base.org",
        chain: "base-sepolia",
      });

      expect(aegis.escrow).toBeDefined();
      expect(aegis.dispute).toBeDefined();
    });
  });
});
```

### Step 2: Run test to verify it fails

Run:
```bash
cd sdk/packages/sdk && pnpm test -- --run src/__tests__/client.test.ts
```
Expected: FAIL — `Cannot find module '../client'`

### Step 3: Write the unified client

Create `sdk/packages/sdk/src/client.ts`:
```typescript
import type { PublicClient, WalletClient } from "viem";
import { createPublicClient, http } from "viem";
import { baseSepolia, base } from "viem/chains";

import type {
  SupportedChain,
  ChainConfig,
  ContractAddresses,
} from "@aegis-protocol/types";
import { CHAIN_CONFIGS } from "@aegis-protocol/types";

import { ViemAdapter } from "./adapters/viem";
import { EthersAdapter } from "./adapters/ethers";
import type { AegisProvider } from "./provider";
import { EscrowService } from "./escrow";
import { DisputeService } from "./dispute";
import { TreasuryService } from "./treasury";
import { FactoryService } from "./factory";
import { IdentityService } from "./erc8004/identity";
import { ReputationService } from "./erc8004/reputation";
import { ValidationService } from "./erc8004/validation";

/** Options for AegisClient.fromViem() */
export interface ViemClientOptions {
  walletClient: WalletClient;
  publicClient: PublicClient;
  chain: SupportedChain | ChainConfig;
  contracts?: Partial<ContractAddresses>;
}

/** Options for AegisClient.fromEthers() */
export interface EthersClientOptions {
  signer: any; // ethers.Signer
  provider?: any; // ethers.Provider (optional, derived from signer)
  chain: SupportedChain | ChainConfig;
  contracts?: Partial<ContractAddresses>;
}

/** Options for AegisClient.readOnly() */
export interface ReadOnlyClientOptions {
  rpcUrl?: string;
  chain: SupportedChain | ChainConfig;
  contracts?: Partial<ContractAddresses>;
}

const CHAIN_MAP = {
  "base-sepolia": baseSepolia,
  base: base,
} as const;

/**
 * AegisClient — unified entry point for all AEGIS Protocol interactions.
 *
 * @example
 * ```ts
 * const aegis = AegisClient.fromViem({ walletClient, publicClient, chain: "base-sepolia" });
 * const jobId = await aegis.escrow.createJob({ ... });
 * ```
 */
export class AegisClient {
  public readonly escrow: EscrowService;
  public readonly dispute: DisputeService;
  public readonly treasury: TreasuryService;
  public readonly factory: FactoryService;
  public readonly identity: IdentityService;
  public readonly reputation: ReputationService;
  public readonly validation: ValidationService;

  private readonly provider: AegisProvider;

  private constructor(provider: AegisProvider, addresses: ContractAddresses) {
    this.provider = provider;
    this.escrow = new EscrowService(provider, addresses);
    this.dispute = new DisputeService(provider, addresses);
    this.treasury = new TreasuryService(provider, addresses);
    this.factory = new FactoryService(provider, addresses);
    this.identity = new IdentityService(provider, addresses);
    this.reputation = new ReputationService(provider, addresses);
    this.validation = new ValidationService(provider, addresses);
  }

  /** Create a client from viem wallet + public clients */
  static fromViem(options: ViemClientOptions): AegisClient {
    const adapter = new ViemAdapter(options.walletClient, options.publicClient);
    const addresses = resolveAddresses(options.chain, options.contracts);
    return new AegisClient(adapter, addresses);
  }

  /** Create a client from ethers signer */
  static fromEthers(options: EthersClientOptions): AegisClient {
    const adapter = new EthersAdapter(options.signer, options.provider);
    const addresses = resolveAddresses(options.chain, options.contracts);
    return new AegisClient(adapter, addresses);
  }

  /** Create a read-only client (no signer — can only call view functions) */
  static readOnly(options: ReadOnlyClientOptions): AegisClient {
    const chainConfig = resolveChainConfig(options.chain);
    const rpcUrl = options.rpcUrl ?? chainConfig.rpcUrl;

    const viemChain =
      typeof options.chain === "string"
        ? CHAIN_MAP[options.chain]
        : undefined;

    const publicClient = createPublicClient({
      chain: viemChain,
      transport: http(rpcUrl),
    });

    const adapter = ViemAdapter.readOnly(publicClient);
    const addresses = resolveAddresses(options.chain, options.contracts);
    return new AegisClient(adapter, addresses);
  }

  /** Get the connected wallet address */
  async getAddress() {
    return this.provider.getAddress();
  }

  /** Get the connected chain ID */
  async getChainId() {
    return this.provider.getChainId();
  }
}

// ── Helpers ────────────────────────────────────────────────────

function resolveChainConfig(chain: SupportedChain | ChainConfig): ChainConfig {
  if (typeof chain === "string") {
    const config = CHAIN_CONFIGS[chain];
    if (!config) {
      throw new Error(`Unknown chain: "${chain}". Supported: ${Object.keys(CHAIN_CONFIGS).join(", ")}`);
    }
    return config;
  }
  return chain;
}

function resolveAddresses(
  chain: SupportedChain | ChainConfig,
  overrides?: Partial<ContractAddresses>
): ContractAddresses {
  const config = resolveChainConfig(chain);
  return { ...config.contracts, ...overrides };
}
```

### Step 4: Write the public API barrel export

Create `sdk/packages/sdk/src/index.ts`:
```typescript
// ── Client ───────────────────────────────────────────────────────
export { AegisClient } from "./client";
export type {
  ViemClientOptions,
  EthersClientOptions,
  ReadOnlyClientOptions,
} from "./client";

// ── Service Modules ──────────────────────────────────────────────
export { EscrowService, type CreateJobParams, type SubmitDeliverableParams } from "./escrow";
export { DisputeService, type ResolveByArbitratorParams } from "./dispute";
export { TreasuryService } from "./treasury";
export { FactoryService, type CreateTemplateParams, type CreateJobFromTemplateParams } from "./factory";

// ── ERC-8004 ─────────────────────────────────────────────────────
export { IdentityService } from "./erc8004/identity";
export { ReputationService, type ReputationSummary } from "./erc8004/reputation";
export { ValidationService, type ValidationStatus } from "./erc8004/validation";

// ── Provider Abstraction ─────────────────────────────────────────
export type { AegisProvider } from "./provider";
export { ViemAdapter } from "./adapters/viem";
export { EthersAdapter } from "./adapters/ethers";

// ── Utilities ────────────────────────────────────────────────────
export { parseUSDC, formatUSDC } from "./utils/usdc";

// ── Re-export types ──────────────────────────────────────────────
export {
  JobState,
  DisputeResolution,
  CHAIN_CONFIGS,
  AegisContractError,
  AegisProviderError,
  AegisValidationError,
} from "@aegis-protocol/types";

export type {
  Job,
  Dispute,
  JobTemplate,
  ArbitratorStats,
  Hex,
  ContractAddresses,
  ChainConfig,
  SupportedChain,
  ClientOptions,
  AegisContractErrorData,
} from "@aegis-protocol/types";
```

### Step 5: Run tests to verify

Run:
```bash
cd sdk/packages/sdk && pnpm test
```
Expected: PASS — all tests across all test files pass.

### Step 6: Build the full monorepo

Run:
```bash
cd sdk && pnpm turbo build
```
Expected: All 3 packages build successfully. `dist/` in each package.

### Step 7: Commit

```bash
git add sdk/packages/sdk/src/client.ts sdk/packages/sdk/src/index.ts \
       sdk/packages/sdk/src/__tests__/client.test.ts
git commit -m "feat(sdk): add AegisClient unified entry point + public API

Factory methods: fromViem(), fromEthers(), readOnly().
All 7 service modules accessible via aegis.escrow, .dispute, etc.
Tree-shakeable subpath exports. Full barrel re-export."
```

---

## Task 11: Full Build + Test + Verify

### Step 1: Clean build from scratch

Run:
```bash
cd sdk && pnpm clean && pnpm turbo build
```
Expected: All 3 packages build with zero errors.

### Step 2: Run all tests

Run:
```bash
cd sdk && pnpm turbo test
```
Expected: All tests pass across all packages.

### Step 3: Verify package exports

Run:
```bash
cd sdk && node -e "const sdk = require('./packages/sdk/dist/index.js'); console.log(Object.keys(sdk));"
```
Expected: Prints all exported names (AegisClient, EscrowService, parseUSDC, JobState, etc.)

### Step 4: Final commit

```bash
git add -A sdk/
git commit -m "feat(sdk): Phase 4a complete - AEGIS TypeScript SDK foundation

Monorepo: @aegis-protocol/types, /abis, /sdk
- ABI generation from Foundry artifacts (7 contracts)
- Full type system (enums, structs, errors, config)
- Provider abstraction (viem + ethers adapters)
- All service modules (Escrow, Dispute, Treasury, Factory, ERC-8004)
- Unified AegisClient with fromViem/fromEthers/readOnly
- USDC helpers (parseUSDC/formatUSDC)
- Tree-shakeable subpath exports
- ESM + CJS dual output via tsup"
```

### Step 5: Push to GitHub

Run:
```bash
git push origin main
```

---

## Summary

| Task | What | Files | Tests |
|------|------|-------|-------|
| 1 | Monorepo scaffolding | 12 config files | turbo dry-run |
| 2 | ABI generation | 8 files + script | build verify |
| 3 | Types package | 5 source + 1 test | 6 enum tests |
| 4 | Provider abstraction | 4 source + 1 test | 2 adapter tests |
| 5 | USDC helpers | 2 source + 1 test | 11 tests |
| 6 | Escrow service | 1 source + 1 test | 4 test groups |
| 7 | Dispute service | 1 source + 1 test | 3 test groups |
| 8 | Treasury + Factory | 2 source + 2 tests | 4 test groups |
| 9 | ERC-8004 wrappers | 4 source + 1 test | 3 test groups |
| 10 | AegisClient + API | 2 source + 1 test | 2 test groups |
| 11 | Full build verify | — | all pass |

**Total: ~30 source files, ~10 test files, 11 commits.**
