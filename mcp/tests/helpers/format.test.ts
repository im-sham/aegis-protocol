import { describe, it, expect } from "vitest";
import { JobState, DisputeResolution } from "@aegis-protocol/types";
import type { Job, JobTemplate, Dispute } from "@aegis-protocol/types";
import {
  formatJobForLLM,
  formatTimestamp,
  formatTemplateForLLM,
  formatDisputeForLLM,
  formatReputationForLLM,
} from "../../src/helpers/format.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    clientAgentId: 1n,
    providerAgentId: 2n,
    clientAddress: ZERO_ADDRESS,
    providerWallet: ZERO_ADDRESS,
    jobSpecHash: ZERO_HASH,
    jobSpecURI: "https://example.com/spec",
    templateId: 0n,
    validatorAddress: ZERO_ADDRESS,
    validationRequestHash: ZERO_HASH,
    validationScore: 0,
    validationThreshold: 70,
    amount: 50_000_000n, // 50 USDC
    protocolFeeBps: 250n,
    createdAt: 1700000000n,
    deadline: 1700086400n,
    deliveredAt: 0n,
    settledAt: 0n,
    disputeWindowEnd: 0n,
    deliverableHash: ZERO_HASH,
    deliverableURI: "",
    state: JobState.FUNDED,
    resolution: DisputeResolution.NONE,
    ...overrides,
  };
}

describe("formatTimestamp", () => {
  it("returns N/A for zero timestamp", () => {
    expect(formatTimestamp(0n)).toBe("N/A");
  });

  it("formats a unix timestamp to ISO string", () => {
    const result = formatTimestamp(1700000000n);
    expect(result).toBe("2023-11-14T22:13:20.000Z");
  });
});

describe("formatJobForLLM", () => {
  it("formats a funded job", () => {
    const result = formatJobForLLM("0xabc", makeJob());
    expect(result.jobId).toBe("0xabc");
    expect(result.state).toContain("Funded");
    expect(result.amount).toBe("50.00 USDC");
    expect(result.protocolFee).toBe("2.5%");
    expect(result.clientAgentId).toBe("1");
    expect(result.providerAgentId).toBe("2");
    expect(result.validationThreshold).toBe(70);
    expect(result.deliverableURI).toBe("Not yet delivered");
  });

  it("formats a settled job", () => {
    const result = formatJobForLLM(
      "0xabc",
      makeJob({
        state: JobState.SETTLED,
        settledAt: 1700100000n,
        validationScore: 85,
      }),
    );
    expect(result.state).toContain("Settled");
    expect(result.validationScore).toBe(85);
    expect(result.settledAt).not.toBe("N/A");
  });

  it("formats a disputed job", () => {
    const result = formatJobForLLM(
      "0xabc",
      makeJob({
        state: JobState.DISPUTED,
        resolution: DisputeResolution.RE_VALIDATION,
      }),
    );
    expect(result.state).toContain("Disputed");
    expect(result.resolution).toContain("re-validation");
  });
});

describe("formatTemplateForLLM", () => {
  it("formats a template", () => {
    const template: JobTemplate = {
      name: "code-review",
      defaultValidator: ZERO_ADDRESS,
      defaultTimeout: 86400n,
      feeBps: 250n,
      minValidation: 70,
      defaultDisputeSplit: 50,
      active: true,
      creator: ZERO_ADDRESS,
    };
    const result = formatTemplateForLLM("1", template);
    expect(result.name).toBe("code-review");
    expect(result.defaultTimeout).toBe("24 hours");
    expect(result.fee).toBe("2.5%");
    expect(result.active).toBe(true);
  });
});

describe("formatReputationForLLM", () => {
  it("handles agent with no reputation", () => {
    const result = formatReputationForLLM("1", {
      count: 0n,
      summaryValue: 0n,
      summaryValueDecimals: 2,
    });
    expect(result.hasReputation).toBe(false);
    expect(result.averageScore).toBe("0.00");
  });

  it("handles agent with reputation", () => {
    const result = formatReputationForLLM("1", {
      count: 5n,
      summaryValue: 8500n,
      summaryValueDecimals: 2,
    });
    expect(result.hasReputation).toBe(true);
    expect(result.averageScore).toBe("85.00");
    expect(result.feedbackCount).toBe("5");
  });
});
