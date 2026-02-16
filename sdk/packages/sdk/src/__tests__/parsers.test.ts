import { describe, it, expect } from "vitest";
import type { Hex } from "@aegis-protocol/types";
import type { TransactionReceipt } from "../provider";
import {
  parseJobCreated,
  parseJobSettled,
  parseDisputeInitiated,
  parseDisputeResolved,
  parseTemplateCreated,
} from "../parsers";

// JobCreated event: 3 indexed (jobId, clientAgentId, providerAgentId) + 3 non-indexed (amount, validatorAddress, deadline)
const JOB_CREATED_RECEIPT: TransactionReceipt = {
  transactionHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as Hex,
  blockNumber: 100n,
  status: "success",
  logs: [
    {
      address: "0xe988128467299fD856Bb45D2241811837BF35E77" as Hex,
      topics: [
        "0xc3beba38db0ec2a3c21e693c2ec7e73f6a0a903f3a1753de2484c1bf7d1b2e63" as Hex,
        "0x0000000000000000000000000000000000000000000000000000000000000042" as Hex,
        "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex,
        "0x0000000000000000000000000000000000000000000000000000000000000002" as Hex,
      ],
      data: ("0x" +
        "0000000000000000000000000000000000000000000000000000000000989680" +
        "000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266" +
        "0000000000000000000000000000000000000000000000000000000067890abc"
      ) as Hex,
    },
  ],
};

// JobSettled event: 2 indexed (jobId, providerWallet) + 2 non-indexed (providerAmount, protocolFee)
const JOB_SETTLED_RECEIPT: TransactionReceipt = {
  transactionHash: "0xaabbccdd0000000000000000000000000000000000000000000000000000aaaa" as Hex,
  blockNumber: 200n,
  status: "success",
  logs: [
    {
      address: "0xe988128467299fD856Bb45D2241811837BF35E77" as Hex,
      topics: [
        "0x9d5a3e8b68bbe9a6a4a86dddf20c6e5be64b2e47b0453a2baec4fa7ff98c8b93" as Hex,
        "0x0000000000000000000000000000000000000000000000000000000000000042" as Hex,
        "0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266" as Hex,
      ],
      data: ("0x" +
        "000000000000000000000000000000000000000000000000000000000098967f" +
        "0000000000000000000000000000000000000000000000000000000000003d09"
      ) as Hex,
    },
  ],
};

// DisputeInitiated event: 3 indexed (disputeId, jobId, initiator) + 0 non-indexed
const DISPUTE_INITIATED_RECEIPT: TransactionReceipt = {
  transactionHash: "0xdddd000000000000000000000000000000000000000000000000000000000000" as Hex,
  blockNumber: 300n,
  status: "success",
  logs: [
    {
      address: "0x2c831D663B87194Fa6444df17A9A7d135186Cb41" as Hex,
      topics: [
        "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex,
        "0x00000000000000000000000000000000000000000000000000000000000000aa" as Hex,
        "0x0000000000000000000000000000000000000000000000000000000000000042" as Hex,
        "0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266" as Hex,
      ],
      data: "0x" as Hex,
    },
  ],
};

// DisputeResolved event: 2 indexed (disputeId, jobId) + 2 non-indexed (clientPercent, method)
const DISPUTE_RESOLVED_RECEIPT: TransactionReceipt = {
  transactionHash: "0xeeee000000000000000000000000000000000000000000000000000000000000" as Hex,
  blockNumber: 400n,
  status: "success",
  logs: [
    {
      address: "0x2c831D663B87194Fa6444df17A9A7d135186Cb41" as Hex,
      topics: [
        "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex,
        "0x00000000000000000000000000000000000000000000000000000000000000aa" as Hex,
        "0x0000000000000000000000000000000000000000000000000000000000000042" as Hex,
      ],
      data: ("0x" +
        "0000000000000000000000000000000000000000000000000000000000000032" +
        "0000000000000000000000000000000000000000000000000000000000000001"
      ) as Hex,
    },
  ],
};

const EMPTY_RECEIPT: TransactionReceipt = {
  transactionHash: "0x00" as Hex,
  blockNumber: 0n,
  status: "success",
  logs: [],
};

describe("Event Parsers", () => {
  describe("parseJobCreated", () => {
    it("should decode JobCreated event from receipt logs", () => {
      const result = parseJobCreated(JOB_CREATED_RECEIPT);
      expect(result).toBeDefined();
      expect(result!.jobId).toBe("0x0000000000000000000000000000000000000000000000000000000000000042");
      expect(result!.clientAgentId).toBe(1n);
      expect(result!.providerAgentId).toBe(2n);
      expect(result!.amount).toBe(10_000_000n);
      expect(result!.deadline).toBe(0x67890abcn);
    });

    it("should return null when no matching event", () => {
      expect(parseJobCreated(EMPTY_RECEIPT)).toBeNull();
    });
  });

  describe("parseJobSettled", () => {
    it("should decode JobSettled event", () => {
      const result = parseJobSettled(JOB_SETTLED_RECEIPT);
      expect(result).toBeDefined();
      expect(result!.jobId).toBe("0x0000000000000000000000000000000000000000000000000000000000000042");
      expect(result!.providerAmount).toBeGreaterThan(0n);
      expect(result!.protocolFee).toBeGreaterThan(0n);
    });

    it("should return null when no matching event", () => {
      expect(parseJobSettled(EMPTY_RECEIPT)).toBeNull();
    });
  });

  describe("parseDisputeInitiated", () => {
    it("should decode DisputeInitiated event", () => {
      const result = parseDisputeInitiated(DISPUTE_INITIATED_RECEIPT);
      expect(result).toBeDefined();
      expect(result!.disputeId).toBe("0x00000000000000000000000000000000000000000000000000000000000000aa");
      expect(result!.jobId).toBe("0x0000000000000000000000000000000000000000000000000000000000000042");
    });

    it("should return null when no matching event", () => {
      expect(parseDisputeInitiated(EMPTY_RECEIPT)).toBeNull();
    });
  });

  describe("parseDisputeResolved", () => {
    it("should decode DisputeResolved event", () => {
      const result = parseDisputeResolved(DISPUTE_RESOLVED_RECEIPT);
      expect(result).toBeDefined();
      expect(result!.clientPercent).toBe(50);
      expect(result!.method).toBe(1);
    });

    it("should return null when no matching event", () => {
      expect(parseDisputeResolved(EMPTY_RECEIPT)).toBeNull();
    });
  });

  describe("parseTemplateCreated", () => {
    it("should return null when no matching event", () => {
      expect(parseTemplateCreated(EMPTY_RECEIPT)).toBeNull();
    });
  });
});
