import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AegisClient, Job } from "@aegis-protocol/sdk";
import {
  createAegisAcpResources,
  createAegisAcpSchemas,
  createAegisVirtualsFunctions,
  createAegisVirtualsPrompt,
  createAegisVirtualsWorker,
} from "../index";

type AnyFunction = {
  name: string;
  execute: (
    args: Record<string, { value: string }>,
    logger: (msg: string) => void,
  ) => Promise<{ status: string; feedback: string }>;
};

function getFunction(functions: unknown[], name: string): AnyFunction {
  const fn = (functions as AnyFunction[]).find((entry) => entry.name === name);
  if (!fn) throw new Error(`Missing function: ${name}`);
  return fn;
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
      confirmDelivery: vi
        .fn()
        .mockResolvedValue(
          "0x1212121212121212121212121212121212121212121212121212121212121212",
        ),
      settleAfterDisputeWindow: vi
        .fn()
        .mockResolvedValue(
          "0x3434343434343434343434343434343434343434343434343434343434343434",
        ),
    },
  } as unknown as AegisClient;
}

describe("@aegis-protocol/virtuals", () => {
  let client: AegisClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it("builds a GAME worker with expected function names", () => {
    const worker = createAegisVirtualsWorker({
      client,
      enableWriteFunctions: true,
    });

    expect(worker.id).toBe("aegis-escrow-operator");
    expect(worker.functions.map((fn) => fn.name)).toEqual([
      "aegis_should_i_escrow",
      "aegis_lookup_agent",
      "aegis_check_balance",
      "aegis_check_job",
      "aegis_approve_escrow",
      "aegis_create_job",
      "aegis_submit_deliverable",
      "aegis_settle_job",
    ]);
  });

  it("advisory function returns recommendation and next functions", async () => {
    const functions = createAegisVirtualsFunctions({ client });
    const shouldEscrow = getFunction(functions, "aegis_should_i_escrow");

    const result = await shouldEscrow.execute(
      {
        transactionValueUsd: { value: "75" },
        providerReputationScore: { value: "45" },
        jobType: { value: "code-review" },
        previousInteractions: { value: "0" },
        requiresObjectiveValidation: { value: "true" },
      },
      vi.fn(),
    );

    expect(result.status).toBe("done");
    expect(result.feedback).toContain("STRONGLY_RECOMMENDED");
    expect(result.feedback).toContain("aegis_create_job");
  });

  it("check_balance uses connected wallet when address is omitted", async () => {
    const functions = createAegisVirtualsFunctions({ client });
    const checkBalance = getFunction(functions, "aegis_check_balance");

    const result = await checkBalance.execute({}, vi.fn());

    expect(result.status).toBe("done");
    expect(result.feedback).toContain("10.00 USDC");
    expect(client.usdc.allowance).toHaveBeenCalled();
  });

  it("write functions call SDK services with parsed values", async () => {
    const functions = createAegisVirtualsFunctions({
      client,
      enableWriteFunctions: true,
    });
    const approve = getFunction(functions, "aegis_approve_escrow");
    const createJob = getFunction(functions, "aegis_create_job");
    const submit = getFunction(functions, "aegis_submit_deliverable");
    const settle = getFunction(functions, "aegis_settle_job");

    await approve.execute({ amountUSDC: { value: "5.50" } }, vi.fn());
    await createJob.execute(
      {
        clientAgentId: { value: "1" },
        providerAgentId: { value: "2" },
        amountUSDC: { value: "5.00" },
        jobSpecURI: { value: "https://example.com/spec" },
        jobSpecHash: {
          value:
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
        validatorAddress: {
          value: "0x3333333333333333333333333333333333333333",
        },
      },
      vi.fn(),
    );
    await submit.execute(
      {
        jobId: {
          value:
            "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        },
        deliverableURI: { value: "https://example.com/deliverable" },
        deliverableHash: {
          value:
            "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        },
      },
      vi.fn(),
    );
    await settle.execute(
      {
        jobId: {
          value:
            "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        },
        action: { value: "confirm" },
      },
      vi.fn(),
    );

    expect(client.usdc.approveEscrow).toHaveBeenCalledWith(5_500_000n);
    expect(client.escrow.createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        clientAgentId: 1n,
        providerAgentId: 2n,
        amount: 5_000_000n,
        validationThreshold: 70,
      }),
    );
    expect(client.escrow.submitDeliverable).toHaveBeenCalled();
    expect(client.escrow.confirmDelivery).toHaveBeenCalled();
  });

  it("prompt block and ACP helpers reflect the Virtuals decision surface", () => {
    const prompt = createAegisVirtualsPrompt({ thresholdUsd: 75 });
    const resources = createAegisAcpResources({
      thresholdUsd: 75,
      repoUrl: "https://github.com/im-sham/aegis-protocol",
      docsUrl:
        "https://github.com/im-sham/aegis-protocol/blob/main/content/agent-promotion-playbook.md",
      mcpUrl: "https://www.npmjs.com/package/@aegis-protocol/mcp-server",
    });
    const schemas = createAegisAcpSchemas();

    expect(prompt).toContain("$75");
    expect(prompt).toContain("Agent-first does not mean human-free");
    expect(resources).toHaveLength(3);
    expect(schemas.requirementSchema.required).toContain("jobSpecURI");
    expect(schemas.deliverableSchema.required).toContain("deliverableHash");
  });
});
