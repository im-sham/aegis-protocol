/**
 * End-to-End MCP Tool Tests against Base Sepolia
 *
 * Prerequisites (run once before these tests):
 *   1. Deploy contracts to Base Sepolia (already done)
 *   2. Register agent 1 and agent 2 in MockIdentityRegistry
 *   3. Approve USDC for escrow contract (>= 10 USDC)
 *   4. Create template 0 in AegisJobFactory
 *   5. Set AEGIS_PRIVATE_KEY env var
 *
 * Run: AEGIS_PRIVATE_KEY=0x... npx vitest run tests/e2e/mcp-e2e.test.ts
 */

import { describe, it, expect, beforeAll, vi } from "vitest";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { aegisEscrowAbi } from "@aegis-protocol/abis";

// E2E tests hit real Base Sepolia — need longer timeouts
vi.setConfig({ testTimeout: 120_000 });
import { createSdkClient } from "../../src/sdk-client.js";
import type { McpConfig } from "../../src/config.js";
import { CHAIN_CONFIGS } from "@aegis-protocol/types";

// Tool handlers
import { handleCheckBalance } from "../../src/tools/check-balance.js";
import { handleLookupAgent } from "../../src/tools/lookup-agent.js";
import { handleListJobs } from "../../src/tools/list-jobs.js";
import { handleGetTemplate } from "../../src/tools/get-template.js";
import { handleCheckJob } from "../../src/tools/check-job.js";
import { handleCreateJob } from "../../src/tools/create-job.js";
import { handleDeliverWork } from "../../src/tools/deliver-work.js";
import { handleSettleJob } from "../../src/tools/settle-job.js";
import { handleOpenDispute } from "../../src/tools/open-dispute.js";
import { handleClaimRefund } from "../../src/tools/claim-refund.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEPLOYER = "0x31084ba014bC91D467D008e6fb21f827AC6f7eb0";
const MOCK_VALIDATION_REGISTRY = CHAIN_CONFIGS["base-sepolia"].contracts.validationRegistry;
const ESCROW_ADDRESS = CHAIN_CONFIGS["base-sepolia"].contracts.escrow;

function getConfig(): McpConfig {
  const pk = process.env.AEGIS_PRIVATE_KEY;
  if (!pk) throw new Error("AEGIS_PRIVATE_KEY env var required for E2E tests");
  // Prefer explicit RPC override for CI/local reliability.
  // Default to the shared chain config endpoint used across SDK/MCP.
  const rpcUrl =
    process.env.AEGIS_RPC_URL ??
    process.env.BASE_SEPOLIA_RPC_URL ??
    CHAIN_CONFIGS["base-sepolia"].rpcUrl;
  return {
    chain: "base-sepolia",
    rpcUrl,
    rpcUrls: [rpcUrl],
    privateKey: pk,
    apiUrl: undefined,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isTransientRpcError(error: unknown): boolean {
  const seen = new Set<object>();
  const collect = (value: unknown): string => {
    if (value == null) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (typeof value !== "object") return String(value);
    if (seen.has(value as object)) return "";
    seen.add(value as object);
    const asRecord = value as Record<string, unknown>;
    const parts = [
      typeof asRecord.name === "string" ? asRecord.name : "",
      typeof asRecord.message === "string" ? asRecord.message : "",
      typeof asRecord.stack === "string" ? asRecord.stack : "",
      typeof asRecord.code === "string" ? asRecord.code : "",
      typeof asRecord.shortMessage === "string" ? asRecord.shortMessage : "",
      typeof asRecord.details === "string" ? asRecord.details : "",
    ];
    if (Array.isArray(asRecord.errors)) {
      for (const nested of asRecord.errors) parts.push(collect(nested));
    }
    if ("cause" in asRecord) {
      parts.push(collect(asRecord.cause));
    }
    return parts.filter(Boolean).join("\n");
  };
  const text = collect(error);
  return (
    text.includes("HTTP request failed") ||
    text.includes("fetch failed") ||
    text.includes("ETIMEDOUT") ||
    text.includes("EHOSTUNREACH") ||
    text.includes("ECONNRESET") ||
    text.includes("429") ||
    text.includes("503") ||
    text.includes("504")
  );
}

async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 5,
  delayMs = 3000,
): Promise<T> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientRpcError(error) || i === attempts) {
        throw error;
      }
      console.log(`  ${label}: transient RPC error, retry ${i}/${attempts}`);
      await sleep(delayMs);
    }
  }
  throw lastError;
}

function randomHash(): string {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256);
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Create a funded job and return its ID */
async function createFundedJob(
  client: ReturnType<typeof createSdkClient>,
  config: McpConfig,
): Promise<string> {
  await withRetry("createJob", async () =>
    handleCreateJob(client, config, {
      clientAgentId: "1",
      providerAgentId: "2",
      amount: "1.00",
      jobSpecURI: "https://example.com/e2e-test-spec",
      jobSpecHash: randomHash(),
      validatorAddress: MOCK_VALIDATION_REGISTRY,
      deadlineSeconds: 86400,
    }),
  );
  await sleep(5000);
  const jobIds = await withRetry("getAgentJobs", async () => client.escrow.getAgentJobs(1n));
  return jobIds[jobIds.length - 1] as `0x${string}`;
}

/** Submit a deliverable for a job */
async function deliverJob(
  client: ReturnType<typeof createSdkClient>,
  config: McpConfig,
  jobId: string,
): Promise<void> {
  await withRetry("deliverWork", async () =>
    handleDeliverWork(client, config, {
      jobId,
      deliverableURI: "https://example.com/e2e-deliverable",
      deliverableHash: randomHash(),
    }),
  );
  await sleep(5000);
}

/**
 * Set a validation score on the mock validator and process validation on escrow.
 * Note: if score >= threshold (70), processValidation auto-settles the job.
 * If score < threshold, it opens the DISPUTE_WINDOW.
 */
async function setValidationAndProcess(
  config: McpConfig,
  jobId: string,
  score: number,
) {
  const account = privateKeyToAccount(config.privateKey! as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(config.rpcUrl),
  });
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(config.rpcUrl),
  });

  // Read the validation request hash from the escrow job
  const jobData = await withRetry("readJobForValidation", async () =>
    publicClient.readContract({
      address: ESCROW_ADDRESS as `0x${string}`,
      abi: aegisEscrowAbi,
      functionName: "getJob",
      args: [jobId as `0x${string}`],
    }),
  );

  const requestHash = (jobData as any).validationRequestHash ?? (jobData as any)[8];
  console.log("  Validation request hash:", requestHash);

  // Submit validation response with the given score
  const txHash1 = await withRetry("validationResponse", async () =>
    walletClient.writeContract({
      address: MOCK_VALIDATION_REGISTRY as `0x${string}`,
      abi: [{ type: "function", name: "validationResponse", inputs: [
        { name: "requestHash", type: "bytes32" },
        { name: "response", type: "uint8" },
        { name: "responseURI", type: "string" },
        { name: "responseHash", type: "bytes32" },
        { name: "tag", type: "string" },
      ], outputs: [], stateMutability: "nonpayable" }] as const,
      functionName: "validationResponse",
      args: [requestHash, score, "https://example.com/validation", randomHash() as `0x${string}`, "e2e"],
    }),
  );
  console.log("  validationResponse tx:", txHash1);
  await sleep(3000);

  // Process validation on escrow
  const txHash2 = await withRetry("processValidation", async () =>
    walletClient.writeContract({
      address: ESCROW_ADDRESS as `0x${string}`,
      abi: aegisEscrowAbi,
      functionName: "processValidation",
      args: [jobId as `0x${string}`],
    }),
  );
  console.log("  processValidation tx:", txHash2);
  await sleep(3000);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MCP E2E — Base Sepolia", () => {
  let config: McpConfig;
  let client: ReturnType<typeof createSdkClient>;

  beforeAll(() => {
    config = getConfig();
    client = createSdkClient(config);
  });

  // =========================================================================
  // Phase 1: Read-only tools
  // =========================================================================

  describe("Read-only tools", () => {
    it("aegis_check_balance — returns USDC balance and allowance", async () => {
      const result = await handleCheckBalance(client, config, { address: DEPLOYER });
      console.log("check_balance:", JSON.stringify(result, null, 2));
      expect(result.address).toBe(DEPLOYER);
      expect(result.usdcBalance).toMatch(/USDC$/);
      expect(result.escrowAllowance).toMatch(/USDC$/);
      expect(typeof result.canCreateJob).toBe("boolean");
    });

    it("aegis_lookup_agent — returns agent identity and reputation", async () => {
      const result = await handleLookupAgent(client, { agentId: "1" });
      console.log("lookup_agent:", JSON.stringify(result, null, 2));
      expect(result.agentId).toBe("1");
      expect(result.wallet.toLowerCase()).toBe(DEPLOYER.toLowerCase());
      expect(result.exists).toBe(true);
    });

    it("aegis_list_jobs — returns job list for agent", async () => {
      const result = await handleListJobs(client, { agentId: "1" });
      console.log("list_jobs: totalJobs =", result.totalJobs ?? result.jobs?.length ?? 0);
      expect(result.agentId).toBe("1");
      expect(Array.isArray(result.jobs)).toBe(true);
    });

    it("aegis_get_template — returns template 0 (code-review)", async () => {
      const result = await handleGetTemplate(client, { templateId: "0" });
      console.log("get_template:", JSON.stringify(result, null, 2));
      expect(result.templateId).toBe("0");
      expect(result.name).toBe("code-review");
      expect(result.active).toBe(true);
    });
  });

  // =========================================================================
  // Phase 2: Job lifecycle — auto-settle path (score >= threshold)
  // =========================================================================

  describe("Job lifecycle — auto-settle (validation passes)", () => {
    let jobId: string;

    it("create → fund → deliver → validate(80) → auto-settle", async () => {
      // Create and fund
      jobId = await createFundedJob(client, config);
      console.log("Job created:", jobId);

      const funded = await withRetry("checkJobFunded", async () => handleCheckJob(client, { jobId }));
      expect(funded.stateCode).toBe(1); // FUNDED

      // Deliver
      await deliverJob(client, config, jobId);
      const delivered = await withRetry("checkJobDelivered", async () => handleCheckJob(client, { jobId }));
      expect(delivered.stateCode).toBe(3); // VALIDATING

      // Set passing validation score (80 >= 70) → auto-settles
      console.log("Setting validation score to 80 (auto-settles since >= 70)...");
      await setValidationAndProcess(config, jobId, 80);

      const settled = await withRetry("checkJobSettled", async () => handleCheckJob(client, { jobId }));
      console.log("Final state:", JSON.stringify(settled, null, 2));
      expect(settled.stateCode).toBe(5); // SETTLED
      expect(settled.validationScore).toBe(80);
    });
  });

  // =========================================================================
  // Phase 3: Job lifecycle — confirm path (client confirms during VALIDATING)
  // =========================================================================

  describe("Job lifecycle — client confirm (skips validation)", () => {
    let jobId: string;

    it("create → fund → deliver → client confirms → settled", async () => {
      jobId = await createFundedJob(client, config);
      console.log("Job created:", jobId);

      // Deliver
      await deliverJob(client, config, jobId);
      const delivered = await withRetry("checkJobDeliveredConfirmPath", async () =>
        handleCheckJob(client, { jobId }),
      );
      expect(delivered.stateCode).toBe(3); // VALIDATING

      // Client confirms during VALIDATING (skips validation entirely)
      const result = await withRetry("settleJobConfirm", async () =>
        handleSettleJob(client, config, {
          jobId,
          action: "confirm",
        }),
      );
      console.log("settle_job (confirm):", JSON.stringify(result, null, 2));
      expect(result.success).toBe(true);
      expect(result.txHash).toMatch(/^0x/);

      await sleep(5000);
      const settled = await withRetry("checkJobSettledConfirmPath", async () =>
        handleCheckJob(client, { jobId }),
      );
      console.log("Final state:", JSON.stringify(settled, null, 2));
      expect(settled.stateCode).toBe(5); // SETTLED
    });
  });

  // =========================================================================
  // Phase 4: Read-only mode (unsigned tx)
  // =========================================================================

  describe("Read-only mode — unsigned tx generation", () => {
    it("aegis_create_job — returns unsigned tx when no private key", async () => {
      const rpcUrl = CHAIN_CONFIGS["base-sepolia"].rpcUrl;
      const readOnlyConfig: McpConfig = {
        chain: "base-sepolia",
        rpcUrl,
        rpcUrls: [rpcUrl],
        privateKey: undefined,
        apiUrl: undefined,
      };
      const readOnlyClient = createSdkClient(readOnlyConfig);

      const result = await handleCreateJob(readOnlyClient, readOnlyConfig, {
        clientAgentId: "1",
        providerAgentId: "2",
        amount: "5.00",
        jobSpecURI: "https://example.com/unsigned-test",
        jobSpecHash: randomHash(),
        validatorAddress: MOCK_VALIDATION_REGISTRY,
        deadlineSeconds: 86400,
      });

      console.log("create_job (unsigned):", JSON.stringify(result, null, 2));
      expect(result.success).toBe(false);
      expect(result.mode).toBe("unsigned");
      expect(result.unsignedTx).toBeDefined();
      expect(result.unsignedTx.to).toMatch(/^0x/);
      expect(result.unsignedTx.data).toMatch(/^0x/);
      expect(result.amount).toBe("5.00 USDC");
    });
  });

  // =========================================================================
  // Phase 5: Error handling
  // =========================================================================

  describe("Error handling", () => {
    it("aegis_check_job — throws for non-existent job", async () => {
      await expect(
        handleCheckJob(client, {
          jobId: "0x0000000000000000000000000000000000000000000000000000000000000001",
        }),
      ).rejects.toThrow();
    });

    it("aegis_lookup_agent — throws for non-existent agent", async () => {
      await expect(
        handleLookupAgent(client, { agentId: "999" }),
      ).rejects.toThrow();
    });

    it("aegis_get_template — throws for non-existent template", async () => {
      await expect(
        handleGetTemplate(client, { templateId: "999" }),
      ).rejects.toThrow();
    });
  });
});
