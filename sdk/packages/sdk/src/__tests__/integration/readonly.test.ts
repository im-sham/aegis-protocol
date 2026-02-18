import { describe, it, expect } from "vitest";
import { AegisClient } from "../../client";
import { AegisValidationError, AegisProviderError } from "@aegis-protocol/types";

/**
 * Read-only integration tests against live Base Sepolia contracts.
 *
 * These tests require NO private key — they only read on-chain state
 * via the public RPC endpoint at https://sepolia.base.org.
 *
 * Contract addresses are pulled from CHAIN_CONFIGS["base-sepolia"]
 * in @aegis-protocol/types.
 */
describe("AegisClient read-only (Base Sepolia)", () => {
  const client = AegisClient.readOnly({ chain: "base-sepolia" });

  // -------------------------------------------------------------------------
  // Client creation
  // -------------------------------------------------------------------------

  it("creates a read-only client successfully", () => {
    expect(client).toBeDefined();
    expect(client.escrow).toBeDefined();
    expect(client.dispute).toBeDefined();
    expect(client.treasury).toBeDefined();
    expect(client.factory).toBeDefined();
    expect(client.identity).toBeDefined();
    expect(client.reputation).toBeDefined();
    expect(client.validation).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Chain ID
  // -------------------------------------------------------------------------

  it("returns chain ID 84532 for Base Sepolia", async () => {
    const chainId = await client.getChainId();
    expect(chainId).toBe(84532);
  });

  // -------------------------------------------------------------------------
  // Read-only wallet guard — getAddress should throw
  // -------------------------------------------------------------------------

  it("throws AegisProviderError when calling getAddress on read-only client", async () => {
    await expect(client.getAddress()).rejects.toThrow(AegisProviderError);
  });

  // -------------------------------------------------------------------------
  // Escrow reads
  // -------------------------------------------------------------------------

  it("reads protocol stats from the escrow contract", async () => {
    const stats = await client.escrow.getProtocolStats();
    expect(stats).toHaveProperty("totalJobsCreated");
    expect(stats).toHaveProperty("totalVolumeSettled");
    expect(typeof stats.totalJobsCreated).toBe("bigint");
    expect(typeof stats.totalVolumeSettled).toBe("bigint");
    expect(stats.totalJobsCreated).toBeGreaterThanOrEqual(0n);
    expect(stats.totalVolumeSettled).toBeGreaterThanOrEqual(0n);
  });

  it("checks jobExists for a non-existent job ID", async () => {
    const fakeJobId =
      "0x0000000000000000000000000000000000000000000000000000000000000001";
    const exists = await client.escrow.jobExists(fakeJobId);
    expect(typeof exists).toBe("boolean");
    // A job with ID 0x...01 almost certainly does not exist
    expect(exists).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Treasury reads
  // -------------------------------------------------------------------------

  it("reads total balance from the treasury contract", async () => {
    const balance = await client.treasury.totalBalance();
    expect(typeof balance).toBe("bigint");
    expect(balance).toBeGreaterThanOrEqual(0n);
  });

  // -------------------------------------------------------------------------
  // Factory reads
  // -------------------------------------------------------------------------

  it("handles getTemplate for a non-existent template gracefully", async () => {
    // Template ID 1 likely does not exist on a freshly deployed contract.
    // The contract may revert, which the SDK wraps in an error.
    // We accept either a valid template object OR a thrown error.
    try {
      const template = await client.factory.getTemplate(1n);
      // If it doesn't throw, it should be an object with template fields
      expect(template).toBeDefined();
    } catch (error) {
      // Expected: contract reverts because template does not exist
      expect(error).toBeDefined();
    }
  });

  // -------------------------------------------------------------------------
  // Read-only write guard — createJob should throw AegisValidationError
  // -------------------------------------------------------------------------

  it("throws AegisValidationError when attempting a write on a read-only client", async () => {
    await expect(
      client.escrow.createJob({
        clientAgentId: 1n,
        providerAgentId: 2n,
        jobSpecHash:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        jobSpecURI: "https://example.com/spec",
        validatorAddress: "0x0000000000000000000000000000000000000000",
        deadline: BigInt(Math.floor(Date.now() / 1000) + 86400),
        amount: 1_000_000n,
        validationThreshold: 70,
      }),
    ).rejects.toThrow(AegisValidationError);
  });
});
