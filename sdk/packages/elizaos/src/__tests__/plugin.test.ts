import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AegisClient, Job } from "@aegis-protocol/sdk";
import type { Action, IAgentRuntime, Memory, Provider, State } from "@elizaos/core";
import {
  createAegisElizaActions,
  createAegisElizaPlugin,
  createAegisElizaProvider,
} from "../index";

type SettingsMap = Record<string, string | number | boolean | null | undefined>;

type ActionLike = Action & {
  handler: NonNullable<Action["handler"]>;
};

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

function createRuntime(settings: SettingsMap = {}): IAgentRuntime {
  return {
    getSetting: vi.fn((key: string) => settings[key] ?? null),
  } as unknown as IAgentRuntime;
}

function createMessage(content: Record<string, unknown>): Memory {
  return { content } as unknown as Memory;
}

function createState(values: Record<string, unknown> = {}): State {
  return {
    values,
    data: {},
    text: "",
  } as unknown as State;
}

function getAction(actions: Action[], name: string): ActionLike {
  const action = actions.find((entry) => entry.name === name);
  if (!action?.handler) throw new Error(`Missing action ${name}`);
  return action as ActionLike;
}

describe("@aegis-protocol/elizaos", () => {
  let client: AegisClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it("builds a plugin with provider and expected action names", () => {
    const plugin = createAegisElizaPlugin({
      createClient: () => client,
    });

    expect(plugin.name).toBe("aegis-elizaos");
    expect(plugin.providers?.map((provider) => provider.name)).toEqual([
      "AEGIS_ESCROW_CONTEXT",
    ]);
    expect(plugin.actions?.map((action) => action.name)).toEqual([
      "AEGIS_SHOULD_I_ESCROW",
      "AEGIS_LOOKUP_AGENT",
      "AEGIS_CHECK_BALANCE",
      "AEGIS_CHECK_JOB",
      "AEGIS_APPROVE_ESCROW",
      "AEGIS_CREATE_JOB",
      "AEGIS_SUBMIT_DELIVERABLE",
      "AEGIS_SETTLE_JOB",
    ]);
  });

  it("can exclude write actions when configured read-only", () => {
    const actions = createAegisElizaActions({
      createClient: () => client,
      enableWriteActions: false,
    });

    expect(actions.map((action) => action.name)).toEqual([
      "AEGIS_SHOULD_I_ESCROW",
      "AEGIS_LOOKUP_AGENT",
      "AEGIS_CHECK_BALANCE",
      "AEGIS_CHECK_JOB",
    ]);
  });

  it("provider reports current runtime mode", async () => {
    const provider = createAegisElizaProvider() as Provider;
    const readOnly = await provider.get(
      createRuntime(),
      createMessage({ text: "status" }),
      createState(),
    );
    const signing = await provider.get(
      createRuntime({ AEGIS_PRIVATE_KEY: "0x1234" }),
      createMessage({ text: "status" }),
      createState(),
    );

    expect(readOnly.text).toContain("read-only mode");
    expect(signing.text).toContain("signing mode");
  });

  it("advisory action returns recommendation and next actions", async () => {
    const actions = createAegisElizaActions({ createClient: () => client });
    const action = getAction(actions, "AEGIS_SHOULD_I_ESCROW");

    const result = await action.handler(
      createRuntime(),
      createMessage({
        text: "Should I escrow this job?",
        aegis: {
          transactionValueUsd: 75,
          providerReputationScore: 45,
          jobType: "code-review",
          previousInteractions: 0,
          requiresObjectiveValidation: true,
        },
      }),
      createState(),
      undefined,
      undefined,
      [],
    );

    expect(result?.success).toBe(true);
    expect(result?.data?.recommendation).toBe("STRONGLY_RECOMMENDED");
    expect(result?.data?.recommendedTools).toContain("AEGIS_CREATE_JOB");
  });

  it("balance action uses connected wallet when address is omitted", async () => {
    const actions = createAegisElizaActions({ createClient: () => client });
    const action = getAction(actions, "AEGIS_CHECK_BALANCE");

    const result = await action.handler(
      createRuntime(),
      createMessage({ text: "Check my balance" }),
      createState(),
      undefined,
      undefined,
      [],
    );

    expect(result?.success).toBe(true);
    expect(result?.data?.address).toBe(
      "0x4444444444444444444444444444444444444444",
    );
    expect(client.getAddress).toHaveBeenCalled();
  });

  it("create job action requires a signer-enabled runtime", async () => {
    const actions = createAegisElizaActions({ createClient: () => client });
    const action = getAction(actions, "AEGIS_CREATE_JOB");
    const runtime = createRuntime();

    await expect(
      action.validate(runtime, createMessage({ text: "create job" }), createState()),
    ).resolves.toBe(false);
  });

  it("create job action calls SDK with structured payload", async () => {
    const actions = createAegisElizaActions({ createClient: () => client });
    const action = getAction(actions, "AEGIS_CREATE_JOB");

    const result = await action.handler(
      createRuntime({ AEGIS_PRIVATE_KEY: "0x1234" }),
      createMessage({
        text: "Create escrow job",
        aegis: {
          clientAgentId: "1",
          providerAgentId: "2",
          amountUSDC: "5.00",
          jobSpecURI: "https://example.com/spec",
          jobSpecHash:
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          validatorAddress: "0x3333333333333333333333333333333333333333",
        },
      }),
      createState(),
      undefined,
      undefined,
      [],
    );

    expect(result?.success).toBe(true);
    expect(result?.data?.txHash).toBe(
      "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    );
    expect(client.escrow.createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        clientAgentId: 1n,
        providerAgentId: 2n,
        amount: 5_000_000n,
        validationThreshold: 70,
      }),
    );
  });

  it("settle action can consume jobId from previous results", async () => {
    const actions = createAegisElizaActions({ createClient: () => client });
    const action = getAction(actions, "AEGIS_SETTLE_JOB");

    const result = await action.handler(
      createRuntime({ AEGIS_PRIVATE_KEY: "0x1234" }),
      createMessage({ text: "Confirm delivery" }),
      createState(),
      {
        actionContext: {
          previousResults: [
            {
              success: true,
              data: {
                jobId:
                  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                action: "confirm",
              },
            },
          ],
        },
      },
      undefined,
      [],
    );

    expect(result?.success).toBe(true);
    expect(client.escrow.confirmDelivery).toHaveBeenCalledWith(
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
  });
});
