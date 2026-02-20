import { describe, it, expect, vi } from "vitest";
import { handleCreateJob } from "../../src/tools/create-job.js";
import type { McpConfig } from "../../src/config.js";
import { CHAIN_CONFIGS } from "@aegis-protocol/types";

const TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as const;

function signingConfig(): McpConfig {
  return {
    chain: "base-sepolia",
    rpcUrl: "https://sepolia.base.org",
    privateKey: "0x1234",
    apiUrl: undefined,
  };
}

function readOnlyConfig(): McpConfig {
  return {
    chain: "base-sepolia",
    rpcUrl: "https://sepolia.base.org",
    privateKey: undefined,
    apiUrl: undefined,
  };
}

function mockClient() {
  return {
    escrow: {
      createJob: vi.fn().mockResolvedValue(TX_HASH),
    },
  } as any;
}

const baseArgs = {
  clientAgentId: "1",
  providerAgentId: "2",
  amount: "50.00",
  jobSpecURI: "https://example.com/spec",
  jobSpecHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  validatorAddress: "0x1111111111111111111111111111111111111111",
  deadlineSeconds: 86400,
};

describe("handleCreateJob", () => {
  it("executes transaction in signing mode", async () => {
    const client = mockClient();
    const result = await handleCreateJob(client, signingConfig(), baseArgs);

    expect(client.escrow.createJob).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.txHash).toBe(TX_HASH);
    expect(result.amount).toBe("50.00 USDC");
  });

  it("returns unsigned tx in read-only mode", async () => {
    const client = mockClient();
    const result = await handleCreateJob(client, readOnlyConfig(), baseArgs);

    expect(client.escrow.createJob).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.mode).toBe("unsigned");
    expect(result.unsignedTx).toBeDefined();
    expect(result.unsignedTx.to).toBe(CHAIN_CONFIGS["base-sepolia"].contracts.escrow);
    expect(result.unsignedTx.data).toMatch(/^0x/);
    expect(result.amount).toBe("50.00 USDC");
  });

  it("uses default validation threshold of 70", async () => {
    const client = mockClient();
    const result = await handleCreateJob(client, signingConfig(), baseArgs);
    expect(result.validationThreshold).toBe(70);
  });

  it("accepts custom validation threshold", async () => {
    const client = mockClient();
    const result = await handleCreateJob(client, signingConfig(), {
      ...baseArgs,
      validationThreshold: 90,
    });
    expect(result.validationThreshold).toBe(90);
  });
});
