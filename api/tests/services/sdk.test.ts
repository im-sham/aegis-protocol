import { describe, it, expect, vi, beforeEach } from "vitest";

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
