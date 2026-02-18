import { describe, it, expect, vi } from "vitest";
import { handleLookupAgent } from "../../src/tools/lookup-agent.js";

const WALLET = "0x1234567890abcdef1234567890abcdef12345678" as const;
const OWNER = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as const;
const CLIENT = "0x1111111111111111111111111111111111111111" as const;

function mockClient() {
  return {
    identity: {
      getAgentWallet: vi.fn().mockResolvedValue(WALLET),
      ownerOf: vi.fn().mockResolvedValue(OWNER),
    },
    reputation: {
      getClients: vi.fn().mockResolvedValue([CLIENT]),
      getSummary: vi.fn().mockResolvedValue({
        count: 10n,
        summaryValue: 8200n,
        summaryValueDecimals: 2,
      }),
    },
  } as any;
}

describe("handleLookupAgent", () => {
  it("returns agent identity and reputation", async () => {
    const client = mockClient();
    const result = await handleLookupAgent(client, { agentId: "1" });

    expect(client.identity.getAgentWallet).toHaveBeenCalledWith(1n);
    expect(client.identity.ownerOf).toHaveBeenCalledWith(1n);
    expect(client.reputation.getClients).toHaveBeenCalledWith(1n);
    expect(client.reputation.getSummary).toHaveBeenCalledWith(1n, [CLIENT]);

    expect(result.agentId).toBe("1");
    expect(result.wallet).toBe(WALLET);
    expect(result.owner).toBe(OWNER);
    expect(result.exists).toBe(true);
    expect(result.hasReputation).toBe(true);
    expect(result.averageScore).toBe("82.00");
    expect(result.feedbackCount).toBe("10");
  });
});
