import { describe, it, expect, vi, beforeEach } from "vitest";
import { CHAIN_CONFIGS } from "@aegis-protocol/sdk";
import type { AegisClient, Job } from "@aegis-protocol/sdk";
import { createAegisLangChainTools } from "../index";

type AnyTool = {
  name: string;
  invoke: (input: unknown) => Promise<unknown>;
};

function getTool(tools: unknown[], name: string): AnyTool {
  const tool = (tools as AnyTool[]).find((entry) => entry.name === name);
  if (!tool) throw new Error(`Missing tool: ${name}`);
  return tool;
}

function createMockJob(): Job {
  return {
    clientAgentId: 1n,
    providerAgentId: 2n,
    clientAddress: "0x1111111111111111111111111111111111111111",
    providerWallet: "0x2222222222222222222222222222222222222222",
    jobSpecHash:
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    jobSpecURI: "https://example.com/spec",
    templateId: 0n,
    validatorAddress: "0x3333333333333333333333333333333333333333",
    validationRequestHash:
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    validationScore: 82,
    validationThreshold: 70,
    amount: 5_000_000n,
    protocolFeeBps: 250n,
    createdAt: 1_700_000_000n,
    deadline: 1_700_086_400n,
    deliveredAt: 0n,
    settledAt: 0n,
    disputeWindowEnd: 0n,
    deliverableHash:
      "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    deliverableURI: "",
    state: 1,
    resolution: 0,
  } as unknown as Job;
}

function createMockClient(): AegisClient {
  return {
    getAddress: vi
      .fn()
      .mockResolvedValue("0x4444444444444444444444444444444444444444"),
    usdc: {
      balanceOf: vi.fn().mockResolvedValue(10_000_000n),
      allowance: vi.fn().mockResolvedValue(8_000_000n),
      approveEscrow: vi
        .fn()
        .mockResolvedValue(
          "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        ),
    },
    identity: {
      getAgentWallet: vi
        .fn()
        .mockResolvedValue("0x5555555555555555555555555555555555555555"),
      ownerOf: vi
        .fn()
        .mockResolvedValue("0x6666666666666666666666666666666666666666"),
    },
    reputation: {
      getClients: vi
        .fn()
        .mockResolvedValue(["0x7777777777777777777777777777777777777777"]),
      getSummary: vi.fn().mockResolvedValue({
        count: 3n,
        summaryValue: 273n,
        summaryValueDecimals: 2,
      }),
    },
    escrow: {
      getJob: vi.fn().mockResolvedValue(createMockJob()),
      createJob: vi
        .fn()
        .mockResolvedValue(
          "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        ),
      submitDeliverable: vi
        .fn()
        .mockResolvedValue(
          "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        ),
    },
  } as unknown as AegisClient;
}

describe("@aegis-protocol/langchain", () => {
  let client: AegisClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it("returns read-only toolset by default", () => {
    const tools = createAegisLangChainTools({ client });
    const names = (tools as AnyTool[]).map((tool) => tool.name).sort();
    expect(names).toEqual([
      "aegis_check_balance",
      "aegis_check_job",
      "aegis_lookup_agent",
    ]);
  });

  it("aegis_check_balance returns formatted balance and allowance", async () => {
    const tools = createAegisLangChainTools({ client });
    const checkBalance = getTool(tools, "aegis_check_balance");
    const result = (await checkBalance.invoke({
      address: "0x9999999999999999999999999999999999999999",
    })) as Record<string, unknown>;

    expect(result.usdcBalance).toBe("10.00 USDC");
    expect(result.escrowAllowance).toBe("8.00 USDC");
    expect(result.canCreateJob).toBe(true);
    expect(client.usdc.allowance).toHaveBeenCalledWith(
      "0x9999999999999999999999999999999999999999",
      CHAIN_CONFIGS["base-sepolia"].contracts.escrow,
    );
  });

  it("aegis_lookup_agent returns wallet, owner, and summary", async () => {
    const tools = createAegisLangChainTools({ client });
    const lookup = getTool(tools, "aegis_lookup_agent");
    const result = (await lookup.invoke({
      agentId: "1",
    })) as Record<string, unknown>;

    expect(result.wallet).toBe("0x5555555555555555555555555555555555555555");
    expect(result.owner).toBe("0x6666666666666666666666666666666666666666");
    expect(result.feedbackCount).toBe("3");
    expect(result.averageScore).toBe("2.73");
  });

  it("aegis_check_job returns normalized job payload", async () => {
    const tools = createAegisLangChainTools({ client });
    const checkJob = getTool(tools, "aegis_check_job");
    const result = (await checkJob.invoke({
      jobId:
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    })) as Record<string, unknown>;

    expect(result.state).toBe("Funded");
    expect(result.amount).toBe("5.00 USDC");
    expect(result.protocolFee).toBe("2.5%");
  });

  it("includes write tools when enableWriteTools is true", () => {
    const tools = createAegisLangChainTools({ client, enableWriteTools: true });
    const names = (tools as AnyTool[]).map((tool) => tool.name).sort();
    expect(names).toEqual([
      "aegis_approve_escrow",
      "aegis_check_balance",
      "aegis_check_job",
      "aegis_create_job",
      "aegis_lookup_agent",
      "aegis_submit_deliverable",
    ]);
  });

  it("write tools call SDK services with parsed values", async () => {
    const tools = createAegisLangChainTools({ client, enableWriteTools: true });

    const approve = getTool(tools, "aegis_approve_escrow");
    const createJob = getTool(tools, "aegis_create_job");
    const submit = getTool(tools, "aegis_submit_deliverable");

    await approve.invoke({ amountUSDC: "5.50" });
    await createJob.invoke({
      clientAgentId: "1",
      providerAgentId: "2",
      amountUSDC: "5.00",
      jobSpecURI: "https://example.com/spec",
      jobSpecHash:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      validatorAddress: "0x3333333333333333333333333333333333333333",
    });
    await submit.invoke({
      jobId:
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      deliverableURI: "https://example.com/deliverable",
      deliverableHash:
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });

    expect(client.usdc.approveEscrow).toHaveBeenCalledWith(5_500_000n);
    expect(client.escrow.createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        clientAgentId: 1n,
        providerAgentId: 2n,
        amount: 5_000_000n,
        validationThreshold: 70,
      }),
    );
    expect(client.escrow.submitDeliverable).toHaveBeenCalledWith(
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      expect.objectContaining({
        deliverableURI: "https://example.com/deliverable",
      }),
    );
  });
});
