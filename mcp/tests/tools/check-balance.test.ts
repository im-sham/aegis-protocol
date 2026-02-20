import { describe, it, expect, vi } from "vitest";
import { CHAIN_CONFIGS } from "@aegis-protocol/types";
import { handleCheckBalance } from "../../src/tools/check-balance.js";
import type { McpConfig } from "../../src/config.js";

function makeConfig(chain: "base-sepolia" | "base" = "base-sepolia"): McpConfig {
  return {
    chain,
    rpcUrl: CHAIN_CONFIGS[chain].rpcUrl,
    privateKey: undefined,
    apiUrl: undefined,
  };
}

function mockClient(balance: bigint, allowance: bigint) {
  return {
    usdc: {
      balanceOf: vi.fn().mockResolvedValue(balance),
      allowance: vi.fn().mockResolvedValue(allowance),
    },
  } as any;
}

describe("handleCheckBalance", () => {
  it("uses chain-configured escrow address for allowance checks", async () => {
    const client = mockClient(200_000_000n, 150_000_000n);
    const config = makeConfig("base-sepolia");
    const address = "0x1234567890abcdef1234567890abcdef12345678";

    const result = await handleCheckBalance(client, config, { address });

    expect(client.usdc.allowance).toHaveBeenCalledWith(
      address,
      CHAIN_CONFIGS["base-sepolia"].contracts.escrow,
    );
    expect(result.canCreateJob).toBe(true);
    expect(result.usdcBalance).toBe("200.00 USDC");
    expect(result.escrowAllowance).toBe("150.00 USDC");
  });

  it("reports cannot create job when balance or allowance is zero", async () => {
    const client = mockClient(0n, 1n);
    const config = makeConfig("base");
    const result = await handleCheckBalance(client, config, {
      address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    });

    expect(result.canCreateJob).toBe(false);
  });
});
