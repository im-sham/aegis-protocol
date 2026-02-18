import { describe, it, expect, vi } from "vitest";
import { JobState, DisputeResolution } from "@aegis-protocol/types";
import { handleCheckJob } from "../../src/tools/check-job.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

function mockClient(jobOverrides = {}) {
  return {
    escrow: {
      getJob: vi.fn().mockResolvedValue({
        clientAgentId: 1n,
        providerAgentId: 2n,
        clientAddress: ZERO_ADDRESS,
        providerWallet: ZERO_ADDRESS,
        jobSpecHash: ZERO_HASH,
        jobSpecURI: "https://example.com/spec",
        templateId: 0n,
        validatorAddress: ZERO_ADDRESS,
        validationRequestHash: ZERO_HASH,
        validationScore: 85,
        validationThreshold: 70,
        amount: 100_000_000n,
        protocolFeeBps: 250n,
        createdAt: 1700000000n,
        deadline: 1700086400n,
        deliveredAt: 1700050000n,
        settledAt: 1700060000n,
        disputeWindowEnd: 0n,
        deliverableHash: ZERO_HASH,
        deliverableURI: "ipfs://Qm123",
        state: JobState.SETTLED,
        resolution: DisputeResolution.NONE,
        ...jobOverrides,
      }),
    },
  } as any;
}

describe("handleCheckJob", () => {
  it("returns formatted job data", async () => {
    const client = mockClient();
    const result = await handleCheckJob(client, { jobId: "0xabc" });

    expect(client.escrow.getJob).toHaveBeenCalledWith("0xabc");
    expect(result.jobId).toBe("0xabc");
    expect(result.state).toContain("Settled");
    expect(result.amount).toBe("100.00 USDC");
    expect(result.validationScore).toBe(85);
    expect(result.deliverableURI).toBe("ipfs://Qm123");
  });

  it("shows 'Not yet delivered' for empty deliverable", async () => {
    const client = mockClient({ deliverableURI: "", state: JobState.FUNDED });
    const result = await handleCheckJob(client, { jobId: "0xdef" });

    expect(result.deliverableURI).toBe("Not yet delivered");
    expect(result.state).toContain("Funded");
  });
});
