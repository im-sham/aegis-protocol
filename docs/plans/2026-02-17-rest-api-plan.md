# AEGIS REST API Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an HTTP relay server so any AI agent can interact with AEGIS Protocol without importing a Web3 SDK.

**Architecture:** Thin Hono server that imports `@aegis-protocol/sdk` directly. Reads proxy to SDK read methods + subgraph GraphQL queries. Writes accept pre-signed raw transactions, validate the `to` address against the AEGIS contract whitelist, and broadcast via RPC. SSE endpoint streams on-chain events via viem's `watchContractEvent`.

**Tech Stack:** Node 20+, TypeScript, Hono, viem 2.x, Zod, Vitest, graphql-request, Fly.io

**Design Doc:** `docs/plans/2026-02-17-rest-api-design.md`

---

## Task 1: Scaffold Project

**Files:**
- Create: `api/package.json`
- Create: `api/tsconfig.json`
- Create: `api/vitest.config.ts`
- Create: `api/.env.example`
- Create: `api/src/index.ts`
- Create: `api/src/config.ts`

**Step 1: Create package.json**

```json
{
  "name": "@aegis-protocol/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsup src/index.ts --format esm --dts --clean",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@aegis-protocol/sdk": "workspace:*",
    "@aegis-protocol/types": "workspace:*",
    "@aegis-protocol/abis": "workspace:*",
    "@hono/node-server": "^1.12.0",
    "@hono/zod-openapi": "^0.16.0",
    "hono": "^4.5.0",
    "viem": "^2.0.0",
    "graphql-request": "^7.0.0",
    "graphql": "^16.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "@types/node": "^20.0.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Step 3: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 10_000,
  },
});
```

**Step 4: Create .env.example**

```env
# Required
RPC_URL=wss://base-sepolia.g.alchemy.com/v2/YOUR_KEY
SUBGRAPH_URL=https://api.studio.thegraph.com/query/1742229/aegis-protocol/v0.1.0

# Optional
CHAIN=base-sepolia
PORT=3000
```

**Step 5: Create src/config.ts**

```ts
import { CHAIN_CONFIGS, type SupportedChain } from "@aegis-protocol/types";

export interface ApiConfig {
  port: number;
  chain: SupportedChain;
  rpcUrl: string;
  subgraphUrl: string;
}

export function loadConfig(): ApiConfig {
  const chain = (process.env.CHAIN ?? "base-sepolia") as SupportedChain;

  if (!CHAIN_CONFIGS[chain]) {
    throw new Error(`Unsupported chain: ${chain}. Valid: ${Object.keys(CHAIN_CONFIGS).join(", ")}`);
  }

  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error("RPC_URL environment variable is required");

  const subgraphUrl = process.env.SUBGRAPH_URL;
  if (!subgraphUrl) throw new Error("SUBGRAPH_URL environment variable is required");

  return {
    port: parseInt(process.env.PORT ?? "3000", 10),
    chain,
    rpcUrl,
    subgraphUrl,
  };
}
```

**Step 6: Create src/index.ts (minimal Hono app)**

```ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadConfig } from "./config.js";

const app = new Hono();

app.use("*", cors());

app.get("/health", (c) => c.json({ status: "ok", timestamp: Date.now() }));

app.get("/info", (c) => {
  const config = loadConfig();
  return c.json({
    version: "0.1.0",
    chain: config.chain,
    subgraphUrl: config.subgraphUrl,
  });
});

const config = loadConfig();

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`AEGIS API listening on http://localhost:${info.port}`);
});

export { app };
```

**Step 7: Install dependencies**

Run: `cd api && pnpm install`

**Step 8: Verify it compiles**

Run: `cd api && pnpm typecheck`
Expected: No errors

**Step 9: Commit**

```bash
git add api/
git commit -m "feat(api): scaffold Hono project with config and health endpoint"
```

---

## Task 2: SDK + Subgraph Service Singletons

**Files:**
- Create: `api/src/services/sdk.ts`
- Create: `api/src/services/subgraph.ts`
- Create: `api/tests/services/sdk.test.ts`

**Step 1: Write the failing test for SDK singleton**

```ts
// api/tests/services/sdk.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// We'll test that createSdkClient returns a read-only AegisClient
// and that getContractAddresses returns the correct addresses for the chain.

describe("SDK service", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("createSdkClient returns an AegisClient with escrow service", async () => {
    const { createSdkClient } = await import("../../src/services/sdk.js");
    const client = createSdkClient("base-sepolia", "https://sepolia.base.org");
    expect(client.escrow).toBeDefined();
    expect(client.dispute).toBeDefined();
    expect(client.treasury).toBeDefined();
    expect(client.factory).toBeDefined();
  });

  it("getContractAddresses returns whitelisted addresses", async () => {
    const { getContractAddresses } = await import("../../src/services/sdk.js");
    const addrs = getContractAddresses("base-sepolia");
    expect(addrs.escrow).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(addrs.dispute).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(addrs.treasury).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(addrs.factory).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("getContractWhitelist returns lowercase set of 4 addresses", async () => {
    const { getContractWhitelist } = await import("../../src/services/sdk.js");
    const whitelist = getContractWhitelist("base-sepolia");
    expect(whitelist.size).toBe(4);
    for (const addr of whitelist) {
      expect(addr).toMatch(/^0x[0-9a-f]{40}$/);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd api && pnpm test -- tests/services/sdk.test.ts`
Expected: FAIL — module not found

**Step 3: Implement SDK service**

```ts
// api/src/services/sdk.ts
import { AegisClient } from "@aegis-protocol/sdk";
import { CHAIN_CONFIGS, type SupportedChain, type ContractAddresses } from "@aegis-protocol/types";

export function createSdkClient(chain: SupportedChain, rpcUrl: string): AegisClient {
  return AegisClient.readOnly({ chain, rpcUrl });
}

export function getContractAddresses(chain: SupportedChain): ContractAddresses {
  return CHAIN_CONFIGS[chain].contracts;
}

export function getContractWhitelist(chain: SupportedChain): Set<string> {
  const addrs = getContractAddresses(chain);
  return new Set([
    addrs.escrow.toLowerCase(),
    addrs.dispute.toLowerCase(),
    addrs.treasury.toLowerCase(),
    addrs.factory.toLowerCase(),
  ]);
}
```

**Step 4: Implement subgraph service**

```ts
// api/src/services/subgraph.ts
import { GraphQLClient } from "graphql-request";

let client: GraphQLClient | null = null;

export function getSubgraphClient(url: string): GraphQLClient {
  if (!client) {
    client = new GraphQLClient(url);
  }
  return client;
}

// Reusable query fragments
export const JOB_FIELDS = `
  id
  clientAgentId
  providerAgentId
  clientAddress
  providerWallet
  amount
  protocolFeeBps
  validationScore
  validationThreshold
  jobSpecHash
  jobSpecURI
  deliverableHash
  deliverableURI
  state
  deadline
  createdAt
  deliveredAt
  settledAt
  disputeWindowEnd
  providerAmount
  protocolFee
  refundAmount
  createdAtBlock
  createdAtTx
`;

export const DISPUTE_FIELDS = `
  id
  jobId
  initiator
  respondent
  arbitrator
  clientPercent
  method
  resolved
  createdAt
  resolvedAt
  createdAtBlock
  createdAtTx
`;

export const TEMPLATE_FIELDS = `
  id
  templateId
  name
  creator
  defaultValidator
  defaultTimeout
  minValidation
  active
  createdAt
  jobCount
`;
```

**Step 5: Run tests**

Run: `cd api && pnpm test -- tests/services/sdk.test.ts`
Expected: PASS (3 tests)

**Step 6: Commit**

```bash
git add api/src/services/ api/tests/
git commit -m "feat(api): add SDK and subgraph service singletons"
```

---

## Task 3: Transaction Relay Service

**Files:**
- Create: `api/src/services/relay.ts`
- Create: `api/src/schemas/relay.ts`
- Create: `api/tests/services/relay.test.ts`

**Step 1: Write the failing tests**

```ts
// api/tests/services/relay.test.ts
import { describe, it, expect } from "vitest";
import { validateSignedTransaction } from "../../src/services/relay.js";

// Use a known Base Sepolia contract whitelist
const WHITELIST = new Set([
  "0xe988128467299fd856bb45d2241811837bf35e77",
  "0x2c831d663b87194fa6444df17a9a7d135186cb41",
  "0xe64d271a863aa1438fbb36bd1f280fa1f499c3f5",
  "0xfd451befa1ee3eb4dbca4e9ea539b4bf432866da",
]);

describe("relay service", () => {
  it("rejects tx with non-whitelisted to address", () => {
    const result = validateSignedTransaction(
      {
        to: "0x0000000000000000000000000000000000000001",
        chainId: 84532,
      },
      WHITELIST,
      84532,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not an AEGIS contract");
  });

  it("rejects tx with wrong chain ID", () => {
    const result = validateSignedTransaction(
      {
        to: "0xe988128467299fD856Bb45D2241811837BF35E77",
        chainId: 1,
      },
      WHITELIST,
      84532,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("chain ID");
  });

  it("rejects tx with no to address (contract creation)", () => {
    const result = validateSignedTransaction(
      {
        to: null,
        chainId: 84532,
      },
      WHITELIST,
      84532,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Contract creation");
  });

  it("accepts valid tx to whitelisted contract", () => {
    const result = validateSignedTransaction(
      {
        to: "0xe988128467299fD856Bb45D2241811837BF35E77",
        chainId: 84532,
      },
      WHITELIST,
      84532,
    );
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("accepts valid tx case-insensitive", () => {
    const result = validateSignedTransaction(
      {
        to: "0xE988128467299FD856BB45D2241811837BF35E77",
        chainId: 84532,
      },
      WHITELIST,
      84532,
    );
    expect(result.valid).toBe(true);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd api && pnpm test -- tests/services/relay.test.ts`
Expected: FAIL — module not found

**Step 3: Create Zod schemas**

```ts
// api/src/schemas/relay.ts
import { z } from "zod";

export const RelayRequestSchema = z.object({
  signedTx: z
    .string()
    .regex(/^0x[0-9a-fA-F]+$/, "Must be a hex-encoded signed transaction"),
});

export const RelayResponseSchema = z.object({
  txHash: z.string(),
  blockNumber: z.number().optional(),
  status: z.enum(["pending", "success", "reverted"]),
  events: z
    .array(
      z.object({
        name: z.string(),
        args: z.record(z.unknown()),
      }),
    )
    .optional(),
});

export type RelayRequest = z.infer<typeof RelayRequestSchema>;
export type RelayResponse = z.infer<typeof RelayResponseSchema>;
```

**Step 4: Implement relay service**

```ts
// api/src/services/relay.ts
import {
  createPublicClient,
  http,
  webSocket,
  parseTransaction,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
} from "viem";
import { baseSepolia, base } from "viem/chains";

const CHAIN_MAP = { "base-sepolia": baseSepolia, base } as const;

export interface DecodedTxInfo {
  to: string | null;
  chainId: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateSignedTransaction(
  decoded: DecodedTxInfo,
  whitelist: Set<string>,
  expectedChainId: number,
): ValidationResult {
  if (!decoded.to) {
    return { valid: false, error: "Contract creation transactions are not allowed" };
  }

  if (decoded.chainId !== expectedChainId) {
    return {
      valid: false,
      error: `Wrong chain ID: got ${decoded.chainId}, expected ${expectedChainId}`,
    };
  }

  if (!whitelist.has(decoded.to.toLowerCase())) {
    return {
      valid: false,
      error: `Target ${decoded.to} is not an AEGIS contract`,
    };
  }

  return { valid: true };
}

export function decodeRawTransaction(signedTx: Hex): DecodedTxInfo {
  const parsed = parseTransaction(signedTx);
  return {
    to: parsed.to ?? null,
    chainId: parsed.chainId ? Number(parsed.chainId) : 0,
  };
}

export async function broadcastTransaction(
  rpcUrl: string,
  chain: keyof typeof CHAIN_MAP,
  signedTx: Hex,
  wait: boolean,
): Promise<{
  txHash: Hex;
  receipt?: TransactionReceipt;
}> {
  const transport = rpcUrl.startsWith("ws") ? webSocket(rpcUrl) : http(rpcUrl);
  const client = createPublicClient({ chain: CHAIN_MAP[chain], transport });

  const txHash = await client.sendRawTransaction({ serializedTransaction: signedTx });

  if (!wait) {
    return { txHash };
  }

  const receipt = await client.waitForTransactionReceipt({ hash: txHash });
  return { txHash, receipt };
}
```

**Step 5: Run tests**

Run: `cd api && pnpm test -- tests/services/relay.test.ts`
Expected: PASS (5 tests)

**Step 6: Commit**

```bash
git add api/src/services/relay.ts api/src/schemas/relay.ts api/tests/services/relay.test.ts
git commit -m "feat(api): add transaction relay service with validation"
```

---

## Task 4: Middleware (Rate Limiting, Error Handler)

**Files:**
- Create: `api/src/middleware/rate-limit.ts`
- Create: `api/src/middleware/error-handler.ts`
- Create: `api/tests/middleware/rate-limit.test.ts`
- Create: `api/tests/middleware/error-handler.test.ts`

**Step 1: Write the failing tests**

```ts
// api/tests/middleware/rate-limit.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { rateLimiter } from "../../src/middleware/rate-limit.js";

describe("rate limiter", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.use("*", rateLimiter({ windowMs: 1000, max: 3 }));
    app.get("/test", (c) => c.json({ ok: true }));
  });

  it("allows requests within the limit", async () => {
    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });

  it("returns 429 after exceeding the limit", async () => {
    for (let i = 0; i < 3; i++) {
      await app.request("/test");
    }
    const res = await app.request("/test");
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain("rate limit");
  });
});
```

```ts
// api/tests/middleware/error-handler.test.ts
import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { errorHandler } from "../../src/middleware/error-handler.js";

describe("error handler", () => {
  it("catches thrown errors and returns sanitized JSON", async () => {
    const app = new Hono();
    app.onError(errorHandler);
    app.get("/fail", () => {
      throw new Error("internal secret details");
    });

    const res = await app.request("/fail");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(body.message).toBeUndefined();
  });

  it("returns 400 for validation errors", async () => {
    const app = new Hono();
    app.onError(errorHandler);
    app.get("/fail", () => {
      const err = new Error("bad input") as any;
      err.status = 400;
      throw err;
    });

    const res = await app.request("/fail");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("bad input");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd api && pnpm test -- tests/middleware/`
Expected: FAIL — modules not found

**Step 3: Implement rate limiter**

```ts
// api/src/middleware/rate-limit.ts
import type { MiddlewareHandler } from "hono";

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export function rateLimiter(options: RateLimitOptions): MiddlewareHandler {
  const store = new Map<string, RateLimitEntry>();

  // Periodic cleanup every 60s
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) store.delete(key);
    }
  }, 60_000).unref();

  return async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("cf-connecting-ip") ??
      "unknown";

    const now = Date.now();
    let entry = store.get(ip);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + options.windowMs };
      store.set(ip, entry);
    }

    entry.count++;

    c.header("X-RateLimit-Limit", String(options.max));
    c.header("X-RateLimit-Remaining", String(Math.max(0, options.max - entry.count)));
    c.header("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > options.max) {
      return c.json(
        { error: "Too many requests — rate limit exceeded", retryAfter: Math.ceil((entry.resetAt - now) / 1000) },
        429,
      );
    }

    await next();
  };
}
```

**Step 4: Implement error handler**

```ts
// api/src/middleware/error-handler.ts
import type { ErrorHandler } from "hono";

export const errorHandler: ErrorHandler = (err, c) => {
  const status = (err as any).status ?? 500;

  if (status >= 500) {
    console.error("[AEGIS API Error]", err);
    return c.json({ error: "Internal server error" }, 500);
  }

  return c.json({ error: err.message }, status);
};
```

**Step 5: Run tests**

Run: `cd api && pnpm test -- tests/middleware/`
Expected: PASS (4 tests)

**Step 6: Commit**

```bash
git add api/src/middleware/ api/tests/middleware/
git commit -m "feat(api): add rate limiter and error handler middleware"
```

---

## Task 5: Read Routes — Jobs

**Files:**
- Create: `api/src/routes/jobs.ts`
- Create: `api/src/schemas/query.ts`
- Create: `api/tests/routes/jobs.test.ts`

**Step 1: Write the failing tests**

```ts
// api/tests/routes/jobs.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// We test route wiring: that routes exist and return expected shapes.
// SDK calls will be mocked.
describe("job routes", () => {
  it("GET /jobs/:id returns job data", async () => {
    // Deferred to integration: test that the route exists and wires to the service
    const { createJobRoutes } = await import("../../src/routes/jobs.js");
    const app = new Hono();
    // We'll verify the route registration doesn't throw
    expect(() => createJobRoutes()).not.toThrow();
  });
});
```

Note: Full route tests require mocking the SDK client. These will be expanded in Task 9 (integration tests). For now we test that routes mount without errors.

**Step 2: Create query schemas**

```ts
// api/src/schemas/query.ts
import { z } from "zod";

export const PaginationSchema = z.object({
  first: z.coerce.number().int().min(1).max(100).default(20),
  skip: z.coerce.number().int().min(0).default(0),
});

export const JobQuerySchema = PaginationSchema.extend({
  state: z.string().optional(),
  client: z.string().optional(),
  provider: z.string().optional(),
});

export const HexParamSchema = z.object({
  id: z.string().regex(/^0x[0-9a-fA-F]+$/, "Must be a hex string"),
});

export const AddressParamSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid address"),
});

export const AgentIdParamSchema = z.object({
  id: z.coerce.bigint(),
});
```

**Step 3: Implement job routes**

```ts
// api/src/routes/jobs.ts
import { Hono } from "hono";
import type { AegisClient } from "@aegis-protocol/sdk";
import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { JOB_FIELDS } from "../services/subgraph.js";

export function createJobRoutes(sdk?: AegisClient, subgraph?: GraphQLClient): Hono {
  const router = new Hono();

  // GET /jobs/:id — contract state
  router.get("/:id", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const jobId = c.req.param("id") as `0x${string}`;
    const job = await sdk.escrow.getJob(jobId);
    return c.json(job);
  });

  // GET /jobs/:id/history — subgraph events
  router.get("/:id/history", async (c) => {
    if (!subgraph) return c.json({ error: "Subgraph not initialized" }, 503);
    const jobId = c.req.param("id");
    const query = gql`
      query JobHistory($jobId: Bytes!) {
        job(id: $jobId) {
          ${JOB_FIELDS}
        }
        jobCreatedEvents(where: { jobId: $jobId }, orderBy: blockTimestamp) {
          blockNumber blockTimestamp transactionHash
          jobId clientAgentId providerAgentId amount
        }
        jobSettledEvents(where: { jobId: $jobId }) {
          blockNumber blockTimestamp transactionHash
          jobId providerWallet providerAmount protocolFee
        }
      }
    `;
    const data = await subgraph.request(query, { jobId });
    return c.json(data);
  });

  // GET /jobs — filterable list via subgraph
  router.get("/", async (c) => {
    if (!subgraph) return c.json({ error: "Subgraph not initialized" }, 503);
    const first = parseInt(c.req.query("first") ?? "20", 10);
    const skip = parseInt(c.req.query("skip") ?? "0", 10);
    const state = c.req.query("state");

    const where = state ? `where: { state: "${state}" }` : "";

    const query = gql`
      query Jobs {
        jobs(first: ${first}, skip: ${skip}, orderBy: createdAt, orderDirection: desc, ${where}) {
          ${JOB_FIELDS}
        }
      }
    `;
    const data = await subgraph.request(query);
    return c.json(data);
  });

  return router;
}
```

**Step 4: Run tests**

Run: `cd api && pnpm test -- tests/routes/jobs.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add api/src/routes/jobs.ts api/src/schemas/query.ts api/tests/routes/jobs.test.ts
git commit -m "feat(api): add job read routes with subgraph queries"
```

---

## Task 6: Read Routes — Disputes, Templates, Agents, USDC, Treasury

**Files:**
- Create: `api/src/routes/disputes.ts`
- Create: `api/src/routes/templates.ts`
- Create: `api/src/routes/agents.ts`
- Create: `api/src/routes/usdc.ts`
- Create: `api/src/routes/treasury.ts`

These all follow the same pattern as Task 5. Each route file exports a factory function that receives the SDK client and subgraph client.

**Step 1: Implement disputes routes**

```ts
// api/src/routes/disputes.ts
import { Hono } from "hono";
import type { AegisClient } from "@aegis-protocol/sdk";
import type { GraphQLClient } from "graphql-request";

export function createDisputeRoutes(sdk?: AegisClient, subgraph?: GraphQLClient): Hono {
  const router = new Hono();

  router.get("/:id", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const disputeId = c.req.param("id") as `0x${string}`;
    const dispute = await sdk.dispute.getDispute(disputeId);
    return c.json(dispute);
  });

  router.get("/job/:jobId", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const jobId = c.req.param("jobId") as `0x${string}`;
    const disputeId = await sdk.dispute.getDisputeForJob(jobId);
    return c.json({ disputeId });
  });

  return router;
}
```

**Step 2: Implement templates routes**

```ts
// api/src/routes/templates.ts
import { Hono } from "hono";
import type { AegisClient } from "@aegis-protocol/sdk";
import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { TEMPLATE_FIELDS } from "../services/subgraph.js";

export function createTemplateRoutes(sdk?: AegisClient, subgraph?: GraphQLClient): Hono {
  const router = new Hono();

  router.get("/:id", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const templateId = BigInt(c.req.param("id"));
    const template = await sdk.factory.getTemplate(templateId);
    return c.json(template, 200, {
      // BigInt serializer
      replacer: (_: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v),
    });
  });

  router.get("/:id/active", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const templateId = BigInt(c.req.param("id"));
    const active = await sdk.factory.isTemplateActive(templateId);
    return c.json({ templateId: templateId.toString(), active });
  });

  router.get("/", async (c) => {
    if (!subgraph) return c.json({ error: "Subgraph not initialized" }, 503);
    const active = c.req.query("active");
    const first = parseInt(c.req.query("first") ?? "20", 10);
    const where = active === "true" ? `where: { active: true }` : "";
    const query = gql`
      query Templates {
        jobTemplates(first: ${first}, orderBy: createdAt, orderDirection: desc, ${where}) {
          ${TEMPLATE_FIELDS}
        }
      }
    `;
    const data = await subgraph.request(query);
    return c.json(data);
  });

  return router;
}
```

**Step 3: Implement agents routes (ERC-8004)**

```ts
// api/src/routes/agents.ts
import { Hono } from "hono";
import type { AegisClient } from "@aegis-protocol/sdk";

export function createAgentRoutes(sdk?: AegisClient): Hono {
  const router = new Hono();

  router.get("/:id/wallet", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const agentId = BigInt(c.req.param("id"));
    const wallet = await sdk.identity.getAgentWallet(agentId);
    return c.json({ agentId: agentId.toString(), wallet });
  });

  router.get("/:id/owner", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const agentId = BigInt(c.req.param("id"));
    const owner = await sdk.identity.ownerOf(agentId);
    return c.json({ agentId: agentId.toString(), owner });
  });

  router.get("/:id/reputation", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const agentId = BigInt(c.req.param("id"));
    // Clients must be passed as query param (comma-separated addresses)
    const clientsParam = c.req.query("clients") ?? "";
    const clients = clientsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) as `0x${string}`[];
    const summary = await sdk.reputation.getSummary(agentId, clients);
    return c.json({
      agentId: agentId.toString(),
      count: summary.count.toString(),
      summaryValue: summary.summaryValue.toString(),
      summaryValueDecimals: summary.summaryValueDecimals,
    });
  });

  router.get("/:id/reputation/clients", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const agentId = BigInt(c.req.param("id"));
    const clients = await sdk.reputation.getClients(agentId);
    return c.json({ agentId: agentId.toString(), clients });
  });

  router.get("/:id/jobs", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const agentId = BigInt(c.req.param("id"));
    const jobs = await sdk.escrow.getAgentJobs(agentId);
    return c.json({ agentId: agentId.toString(), jobs });
  });

  router.get("/:id/jobs/count", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const agentId = BigInt(c.req.param("id"));
    const count = await sdk.escrow.getAgentJobCount(agentId);
    return c.json({ agentId: agentId.toString(), count: count.toString() });
  });

  router.get("/:id/validations", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const agentId = BigInt(c.req.param("id"));
    const validations = await sdk.validation.getAgentValidations(agentId);
    return c.json({ agentId: agentId.toString(), validations });
  });

  return router;
}
```

**Step 4: Implement USDC routes**

```ts
// api/src/routes/usdc.ts
import { Hono } from "hono";
import type { AegisClient } from "@aegis-protocol/sdk";

export function createUsdcRoutes(sdk?: AegisClient): Hono {
  const router = new Hono();

  router.get("/balance/:address", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const address = c.req.param("address") as `0x${string}`;
    const balance = await sdk.usdc.balanceOf(address);
    return c.json({ address, balance: balance.toString() });
  });

  router.get("/allowance/:owner/:spender", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const owner = c.req.param("owner") as `0x${string}`;
    const spender = c.req.param("spender") as `0x${string}`;
    const allowance = await sdk.usdc.allowance(owner, spender);
    return c.json({ owner, spender, allowance: allowance.toString() });
  });

  return router;
}
```

**Step 5: Implement treasury routes**

```ts
// api/src/routes/treasury.ts
import { Hono } from "hono";
import type { AegisClient } from "@aegis-protocol/sdk";

export function createTreasuryRoutes(sdk?: AegisClient): Hono {
  const router = new Hono();

  router.get("/balance", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const balance = await sdk.treasury.totalBalance();
    return c.json({ balance: balance.toString() });
  });

  router.get("/balances", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const balances = await sdk.treasury.getBalances();
    return c.json({
      totalFeesCollected: balances.totalFeesCollected.toString(),
      treasuryBalance: balances.treasuryBalance.toString(),
      arbitratorPoolBalance: balances.arbitratorPoolBalance.toString(),
    });
  });

  return router;
}
```

**Step 6: Verify typecheck**

Run: `cd api && pnpm typecheck`
Expected: No errors

**Step 7: Commit**

```bash
git add api/src/routes/
git commit -m "feat(api): add read routes for disputes, templates, agents, usdc, treasury"
```

---

## Task 7: Relay Route (POST /tx/relay)

**Files:**
- Create: `api/src/routes/relay.ts`
- Create: `api/tests/routes/relay.test.ts`

**Step 1: Write the failing tests**

```ts
// api/tests/routes/relay.test.ts
import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { createRelayRoute } from "../../src/routes/relay.js";

const WHITELIST = new Set([
  "0xe988128467299fd856bb45d2241811837bf35e77",
]);

describe("relay route", () => {
  it("rejects invalid hex body", async () => {
    const app = new Hono();
    app.route("/tx", createRelayRoute(WHITELIST, 84532, "https://sepolia.base.org", "base-sepolia"));

    const res = await app.request("/tx/relay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedTx: "not-hex" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects missing signedTx field", async () => {
    const app = new Hono();
    app.route("/tx", createRelayRoute(WHITELIST, 84532, "https://sepolia.base.org", "base-sepolia"));

    const res = await app.request("/tx/relay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd api && pnpm test -- tests/routes/relay.test.ts`
Expected: FAIL — module not found

**Step 3: Implement relay route**

```ts
// api/src/routes/relay.ts
import { Hono } from "hono";
import type { SupportedChain } from "@aegis-protocol/types";
import { RelayRequestSchema } from "../schemas/relay.js";
import {
  decodeRawTransaction,
  validateSignedTransaction,
  broadcastTransaction,
} from "../services/relay.js";

export function createRelayRoute(
  whitelist: Set<string>,
  chainId: number,
  rpcUrl: string,
  chain: SupportedChain,
): Hono {
  const router = new Hono();

  router.post("/relay", async (c) => {
    // Parse and validate request body
    const body = await c.req.json().catch(() => null);
    const parsed = RelayRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Invalid request", details: parsed.error.issues },
        400,
      );
    }

    const { signedTx } = parsed.data;

    // Decode the signed transaction
    let decoded;
    try {
      decoded = decodeRawTransaction(signedTx as `0x${string}`);
    } catch {
      return c.json({ error: "Failed to decode signed transaction" }, 400);
    }

    // Validate against whitelist and chain
    const validation = validateSignedTransaction(decoded, whitelist, chainId);
    if (!validation.valid) {
      return c.json({ error: validation.error }, 403);
    }

    // Broadcast
    const wait = c.req.query("wait") !== "false";
    try {
      const result = await broadcastTransaction(
        rpcUrl,
        chain,
        signedTx as `0x${string}`,
        wait,
      );

      if (result.receipt) {
        return c.json({
          txHash: result.txHash,
          blockNumber: Number(result.receipt.blockNumber),
          status: result.receipt.status === "success" ? "success" : "reverted",
        });
      }

      return c.json({ txHash: result.txHash, status: "pending" });
    } catch (err: any) {
      return c.json(
        { error: "Transaction broadcast failed", reason: err.shortMessage ?? err.message },
        502,
      );
    }
  });

  return router;
}
```

**Step 4: Run tests**

Run: `cd api && pnpm test -- tests/routes/relay.test.ts`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add api/src/routes/relay.ts api/tests/routes/relay.test.ts
git commit -m "feat(api): add POST /tx/relay route with validation"
```

---

## Task 8: SSE Event Stream

**Files:**
- Create: `api/src/services/events.ts`
- Create: `api/src/routes/events.ts`
- Create: `api/tests/services/events.test.ts`

**Step 1: Write the failing tests**

```ts
// api/tests/services/events.test.ts
import { describe, it, expect } from "vitest";
import { parseStreamFilters } from "../../src/services/events.js";

describe("event stream filters", () => {
  it("parses empty query to no filters", () => {
    const filters = parseStreamFilters({});
    expect(filters.jobId).toBeUndefined();
    expect(filters.contract).toBeUndefined();
    expect(filters.eventType).toBeUndefined();
  });

  it("parses job filter", () => {
    const filters = parseStreamFilters({ job: "0xabc123" });
    expect(filters.jobId).toBe("0xabc123");
  });

  it("parses contract filter", () => {
    const filters = parseStreamFilters({ contract: "escrow" });
    expect(filters.contract).toBe("escrow");
  });

  it("parses event type filter", () => {
    const filters = parseStreamFilters({ type: "JobSettled" });
    expect(filters.eventType).toBe("JobSettled");
  });

  it("parses combined filters", () => {
    const filters = parseStreamFilters({ job: "0x1", contract: "dispute", type: "DisputeResolved" });
    expect(filters.jobId).toBe("0x1");
    expect(filters.contract).toBe("dispute");
    expect(filters.eventType).toBe("DisputeResolved");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd api && pnpm test -- tests/services/events.test.ts`
Expected: FAIL — module not found

**Step 3: Implement event service**

```ts
// api/src/services/events.ts
import {
  createPublicClient,
  webSocket,
  http,
  type PublicClient,
  type Log,
} from "viem";
import { baseSepolia, base } from "viem/chains";
import type { SupportedChain, ContractAddresses } from "@aegis-protocol/types";
import { AegisEscrowAbi } from "@aegis-protocol/abis";
import { AegisDisputeAbi } from "@aegis-protocol/abis";
import { AegisTreasuryAbi } from "@aegis-protocol/abis";
import { AegisJobFactoryAbi } from "@aegis-protocol/abis";

const CHAIN_MAP = { "base-sepolia": baseSepolia, base } as const;

export interface StreamFilters {
  jobId?: string;
  contract?: string;
  eventType?: string;
}

export function parseStreamFilters(query: Record<string, string | undefined>): StreamFilters {
  return {
    jobId: query.job,
    contract: query.contract,
    eventType: query.type,
  };
}

export interface EventSubscriber {
  send: (event: string, data: unknown) => void;
  close: () => void;
}

type UnwatchFn = () => void;

export function watchAllContracts(
  rpcUrl: string,
  chain: SupportedChain,
  addresses: ContractAddresses,
  onEvent: (contractName: string, eventName: string, log: Log) => void,
): UnwatchFn {
  const transport = rpcUrl.startsWith("ws") ? webSocket(rpcUrl) : http(rpcUrl);
  const client = createPublicClient({ chain: CHAIN_MAP[chain], transport });

  const unwatchers: UnwatchFn[] = [];

  // Watch each contract
  const contracts = [
    { name: "escrow", address: addresses.escrow, abi: AegisEscrowAbi },
    { name: "dispute", address: addresses.dispute, abi: AegisDisputeAbi },
    { name: "treasury", address: addresses.treasury, abi: AegisTreasuryAbi },
    { name: "factory", address: addresses.factory, abi: AegisJobFactoryAbi },
  ] as const;

  for (const { name, address, abi } of contracts) {
    const unwatch = client.watchContractEvent({
      address: address as `0x${string}`,
      abi,
      onLogs: (logs) => {
        for (const log of logs) {
          onEvent(name, (log as any).eventName ?? "unknown", log);
        }
      },
    });
    unwatchers.push(unwatch);
  }

  return () => {
    for (const unwatch of unwatchers) unwatch();
  };
}

export function matchesFilters(
  contractName: string,
  eventName: string,
  log: Log,
  filters: StreamFilters,
): boolean {
  if (filters.contract && filters.contract !== contractName) return false;
  if (filters.eventType && filters.eventType !== eventName) return false;
  if (filters.jobId) {
    // Check if any topic or arg contains the jobId
    const logStr = JSON.stringify(log).toLowerCase();
    if (!logStr.includes(filters.jobId.toLowerCase())) return false;
  }
  return true;
}
```

**Step 4: Implement SSE route**

```ts
// api/src/routes/events.ts
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { SupportedChain, ContractAddresses } from "@aegis-protocol/types";
import { parseStreamFilters, watchAllContracts, matchesFilters } from "../services/events.js";

// Track active SSE connections for the /health endpoint
let activeConnections = 0;
export function getActiveConnections(): number {
  return activeConnections;
}

export function createEventRoutes(
  rpcUrl: string,
  chain: SupportedChain,
  addresses: ContractAddresses,
): Hono {
  const router = new Hono();

  router.get("/stream", (c) => {
    const filters = parseStreamFilters({
      job: c.req.query("job"),
      contract: c.req.query("contract"),
      type: c.req.query("type"),
    });

    return streamSSE(c, async (stream) => {
      activeConnections++;

      // Send initial keepalive
      await stream.writeSSE({ data: JSON.stringify({ type: "connected", filters }), event: "system" });

      const unwatch = watchAllContracts(rpcUrl, chain, addresses, (contractName, eventName, log) => {
        if (matchesFilters(contractName, eventName, log, filters)) {
          stream
            .writeSSE({
              data: JSON.stringify({
                contract: contractName,
                event: eventName,
                blockNumber: log.blockNumber?.toString(),
                transactionHash: log.transactionHash,
                args: (log as any).args,
              }),
              event: eventName,
            })
            .catch(() => {});
        }
      });

      // Keepalive every 30s
      const keepalive = setInterval(() => {
        stream.writeSSE({ data: "", event: "ping" }).catch(() => {});
      }, 30_000);

      // Cleanup on disconnect
      stream.onAbort(() => {
        activeConnections--;
        clearInterval(keepalive);
        unwatch();
      });

      // Hold the stream open indefinitely
      await new Promise(() => {});
    });
  });

  return router;
}
```

**Step 5: Run tests**

Run: `cd api && pnpm test -- tests/services/events.test.ts`
Expected: PASS (5 tests)

**Step 6: Commit**

```bash
git add api/src/services/events.ts api/src/routes/events.ts api/tests/services/events.test.ts
git commit -m "feat(api): add SSE event stream with contract watchers"
```

---

## Task 9: Wire Everything in index.ts + Meta Routes

**Files:**
- Modify: `api/src/index.ts`
- Create: `api/src/routes/meta.ts`
- Create: `api/tests/app.test.ts`

**Step 1: Write the failing tests**

```ts
// api/tests/app.test.ts
import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock env vars before importing app
vi.stubEnv("RPC_URL", "https://sepolia.base.org");
vi.stubEnv("SUBGRAPH_URL", "https://api.studio.thegraph.com/query/test/aegis/v0.1.0");
vi.stubEnv("CHAIN", "base-sepolia");

describe("app integration", () => {
  it("GET /health returns 200", async () => {
    const { app } = await import("../src/index.js");
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  it("GET /info returns chain and version", async () => {
    const { app } = await import("../src/index.js");
    const res = await app.request("/info");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.version).toBe("0.1.0");
    expect(body.chain).toBe("base-sepolia");
  });

  it("POST /tx/relay with empty body returns 400", async () => {
    const { app } = await import("../src/index.js");
    const res = await app.request("/tx/relay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("GET /nonexistent returns 404", async () => {
    const { app } = await import("../src/index.js");
    const res = await app.request("/nonexistent");
    expect(res.status).toBe(404);
  });
});
```

**Step 2: Create meta routes**

```ts
// api/src/routes/meta.ts
import { Hono } from "hono";
import type { ContractAddresses, SupportedChain } from "@aegis-protocol/types";
import { getActiveConnections } from "./events.js";

export function createMetaRoutes(
  chain: SupportedChain,
  subgraphUrl: string,
  addresses: ContractAddresses,
): Hono {
  const router = new Hono();

  router.get("/health", (c) =>
    c.json({
      status: "ok",
      timestamp: Date.now(),
      activeStreams: getActiveConnections(),
    }),
  );

  router.get("/info", (c) =>
    c.json({
      version: "0.1.0",
      chain,
      subgraphUrl,
      contracts: {
        escrow: addresses.escrow,
        dispute: addresses.dispute,
        treasury: addresses.treasury,
        factory: addresses.factory,
      },
    }),
  );

  return router;
}
```

**Step 3: Rewrite index.ts to wire everything**

```ts
// api/src/index.ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadConfig } from "./config.js";
import { errorHandler } from "./middleware/error-handler.js";
import { rateLimiter } from "./middleware/rate-limit.js";
import { createSdkClient, getContractAddresses, getContractWhitelist } from "./services/sdk.js";
import { getSubgraphClient } from "./services/subgraph.js";
import { createJobRoutes } from "./routes/jobs.js";
import { createDisputeRoutes } from "./routes/disputes.js";
import { createTemplateRoutes } from "./routes/templates.js";
import { createAgentRoutes } from "./routes/agents.js";
import { createUsdcRoutes } from "./routes/usdc.js";
import { createTreasuryRoutes } from "./routes/treasury.js";
import { createRelayRoute } from "./routes/relay.js";
import { createEventRoutes } from "./routes/events.js";
import { createMetaRoutes } from "./routes/meta.js";
import { CHAIN_CONFIGS } from "@aegis-protocol/types";

const config = loadConfig();
const addresses = getContractAddresses(config.chain);
const whitelist = getContractWhitelist(config.chain);
const chainId = CHAIN_CONFIGS[config.chain].chainId;
const sdk = createSdkClient(config.chain, config.rpcUrl);
const subgraph = getSubgraphClient(config.subgraphUrl);

const app = new Hono();

// Global middleware
app.use("*", cors());
app.use("*", rateLimiter({ windowMs: 60_000, max: 120 }));
app.onError(errorHandler);

// Mount routes
app.route("/", createMetaRoutes(config.chain, config.subgraphUrl, addresses));
app.route("/jobs", createJobRoutes(sdk, subgraph));
app.route("/disputes", createDisputeRoutes(sdk, subgraph));
app.route("/templates", createTemplateRoutes(sdk, subgraph));
app.route("/agents", createAgentRoutes(sdk));
app.route("/usdc", createUsdcRoutes(sdk));
app.route("/treasury", createTreasuryRoutes(sdk));
app.route("/tx", createRelayRoute(whitelist, chainId, config.rpcUrl, config.chain));
app.route("/events", createEventRoutes(config.rpcUrl, config.chain, addresses));

// Only start the server if this file is run directly (not imported for testing)
if (process.env.NODE_ENV !== "test") {
  serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(`AEGIS API v0.1.0 | chain=${config.chain} | http://localhost:${info.port}`);
  });
}

export { app };
```

**Step 4: Run tests**

Run: `cd api && pnpm test`
Expected: ALL tests pass

**Step 5: Commit**

```bash
git add api/src/index.ts api/src/routes/meta.ts api/tests/app.test.ts
git commit -m "feat(api): wire all routes and middleware in app entry point"
```

---

## Task 10: Dockerfile + Fly.io Config

**Files:**
- Create: `api/Dockerfile`
- Create: `api/fly.toml`
- Create: `api/.dockerignore`

**Step 1: Create Dockerfile**

```dockerfile
# api/Dockerfile
FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# Copy workspace root files
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY sdk/package.json sdk/
COPY sdk/packages/types/package.json sdk/packages/types/
COPY sdk/packages/abis/package.json sdk/packages/abis/
COPY sdk/packages/sdk/package.json sdk/packages/sdk/
COPY api/package.json api/

# Install all workspace deps
RUN pnpm install --frozen-lockfile

# Copy source
COPY sdk/ sdk/
COPY api/ api/

# Build SDK packages first (api depends on them)
RUN cd sdk && pnpm build

# Build API
RUN cd api && pnpm build

# Production image
FROM node:20-slim AS runner
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/sdk ./sdk
COPY --from=base /app/api/dist ./api/dist
COPY --from=base /app/api/package.json ./api/

WORKDIR /app/api
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**Step 2: Create .dockerignore**

```
node_modules
dist
.env
*.test.ts
tests/
```

**Step 3: Create fly.toml**

```toml
# api/fly.toml
app = "aegis-api"
primary_region = "ewr"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3000"
  CHAIN = "base-sepolia"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

  [http_service.concurrency]
    type = "connections"
    hard_limit = 1000
    soft_limit = 800

[[http_service.checks]]
  grace_period = "10s"
  interval = "15s"
  method = "GET"
  path = "/health"
  timeout = "3s"
```

**Step 4: Commit**

```bash
git add api/Dockerfile api/fly.toml api/.dockerignore
git commit -m "feat(api): add Dockerfile and Fly.io deployment config"
```

---

## Task 11: CI Pipeline

**Files:**
- Modify: `.github/workflows/test.yml`

**Step 1: Add API job to CI**

Add a new `api` job alongside the existing `check` and `subgraph` jobs:

```yaml
  api:
    name: API (lint + test)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: api
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: pnpm
          cache-dependency-path: "**/pnpm-lock.yaml"
      - run: pnpm install --frozen-lockfile
        working-directory: .
      - run: cd ../sdk && pnpm build
      - run: pnpm typecheck
      - run: pnpm test
        env:
          RPC_URL: https://sepolia.base.org
          SUBGRAPH_URL: https://api.studio.thegraph.com/query/1742229/aegis-protocol/v0.1.0
          CHAIN: base-sepolia
```

**Step 2: Run locally to verify**

Run: `cd api && pnpm typecheck && pnpm test`
Expected: All pass

**Step 3: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: add API lint and test job"
```

---

## Task 12: Monorepo Integration

**Files:**
- Create: `pnpm-workspace.yaml` (root)
- Create: `api/.gitignore`
- Modify: `.gitignore`

**Step 1: Create root pnpm-workspace.yaml**

Check if this already exists. If not, create it to link `sdk/` and `api/` as workspace packages:

```yaml
packages:
  - "sdk"
  - "sdk/packages/*"
  - "api"
```

**Step 2: Create api/.gitignore**

```
node_modules/
dist/
.env
```

**Step 3: Verify full workspace builds**

Run from project root:
```bash
pnpm install
cd sdk && pnpm build
cd ../api && pnpm typecheck && pnpm test
```
Expected: All pass

**Step 4: Commit**

```bash
git add pnpm-workspace.yaml api/.gitignore .gitignore
git commit -m "chore: integrate api into pnpm workspace"
```

---

## Execution Summary

| Task | What | Tests |
|------|------|-------|
| 1 | Scaffold (Hono, config, health) | — |
| 2 | SDK + subgraph singletons | 3 |
| 3 | Tx relay service + validation | 5 |
| 4 | Rate limiter + error handler | 4 |
| 5 | Job read routes | 1 |
| 6 | All other read routes | — |
| 7 | POST /tx/relay route | 2 |
| 8 | SSE event stream | 5 |
| 9 | Wire app + meta routes | 4 |
| 10 | Dockerfile + Fly.io config | — |
| 11 | CI pipeline | — |
| 12 | Monorepo integration | — |
| **Total** | **12 tasks** | **24+ tests** |

**Dependencies:** Tasks 1-4 are foundational. Tasks 5-8 can be parallelized. Task 9 depends on 5-8. Tasks 10-12 can be parallelized after 9.
