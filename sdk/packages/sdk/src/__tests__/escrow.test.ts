import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Hex, ContractAddresses } from "@aegis-protocol/types";
import { AegisValidationError } from "@aegis-protocol/types";
import type { AegisProvider, TransactionReceipt } from "../provider";
import { EscrowService } from "../escrow";
import type { CreateJobParams, SubmitDeliverableParams } from "../escrow";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ESCROW_ADDRESS = "0x1111111111111111111111111111111111111111" as Hex;
const FAKE_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as Hex;
const FAKE_JOB_ID = "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex;

function createAddresses(): ContractAddresses {
  return {
    escrow: ESCROW_ADDRESS,
    dispute: "0x2222222222222222222222222222222222222222",
    treasury: "0x3333333333333333333333333333333333333333",
    factory: "0x4444444444444444444444444444444444444444",
    usdc: "0x5555555555555555555555555555555555555555",
    identityRegistry: "0x6666666666666666666666666666666666666666",
    reputationRegistry: "0x7777777777777777777777777777777777777777",
    validationRegistry: "0x8888888888888888888888888888888888888888",
  };
}

function createMockProvider(readOnly = false): AegisProvider {
  return {
    readContract: vi.fn().mockResolvedValue(undefined),
    writeContract: vi.fn().mockResolvedValue(FAKE_TX_HASH),
    waitForTransaction: vi.fn(),
    watchContractEvent: vi.fn().mockReturnValue(() => {}),
    getAddress: vi.fn().mockResolvedValue("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as Hex),
    getChainId: vi.fn().mockResolvedValue(84532),
    isReadOnly: readOnly,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EscrowService", () => {
  let provider: AegisProvider;
  let service: EscrowService;

  beforeEach(() => {
    provider = createMockProvider();
    service = new EscrowService(provider, createAddresses());
  });

  // ---- Write methods ----

  describe("createJob", () => {
    it("should call writeContract with correct args", async () => {
      const params: CreateJobParams = {
        clientAgentId: 1n,
        providerAgentId: 2n,
        jobSpecHash: "0xaaaa000000000000000000000000000000000000000000000000000000000000",
        jobSpecURI: "ipfs://spec",
        validatorAddress: "0x9999999999999999999999999999999999999999",
        deadline: 1700000000n,
        amount: 10_000_000n,
        validationThreshold: 70,
      };

      const result = await service.createJob(params);

      expect(result).toBe(FAKE_TX_HASH);
      expect(provider.writeContract).toHaveBeenCalledWith({
        address: ESCROW_ADDRESS,
        abi: expect.any(Array),
        functionName: "createJob",
        args: [
          params.clientAgentId,
          params.providerAgentId,
          params.jobSpecHash,
          params.jobSpecURI,
          params.validatorAddress,
          params.deadline,
          params.amount,
          params.validationThreshold,
        ],
      });
    });
  });

  describe("createJobAndWait", () => {
    const JOB_CREATED_RECEIPT: TransactionReceipt = {
      transactionHash: FAKE_TX_HASH,
      blockNumber: 100n,
      status: "success",
      logs: [
        {
          address: ESCROW_ADDRESS,
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

    it("should return parsed JobCreatedEvent after tx is mined", async () => {
      vi.mocked(provider.waitForTransaction).mockResolvedValue(JOB_CREATED_RECEIPT);

      const params: CreateJobParams = {
        clientAgentId: 1n,
        providerAgentId: 2n,
        jobSpecHash: "0xaaaa000000000000000000000000000000000000000000000000000000000000",
        jobSpecURI: "ipfs://spec",
        validatorAddress: "0x9999999999999999999999999999999999999999",
        deadline: 1700000000n,
        amount: 10_000_000n,
        validationThreshold: 70,
      };

      const event = await service.createJobAndWait(params);

      expect(event.clientAgentId).toBe(1n);
      expect(event.providerAgentId).toBe(2n);
      expect(event.amount).toBe(10_000_000n);
      expect(provider.writeContract).toHaveBeenCalled();
      expect(provider.waitForTransaction).toHaveBeenCalledWith(FAKE_TX_HASH);
    });

    it("should throw if JobCreated event not found in receipt", async () => {
      vi.mocked(provider.waitForTransaction).mockResolvedValue({
        transactionHash: FAKE_TX_HASH,
        blockNumber: 100n,
        status: "success",
        logs: [],
      });

      await expect(
        service.createJobAndWait({
          clientAgentId: 1n,
          providerAgentId: 2n,
          jobSpecHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
          jobSpecURI: "",
          validatorAddress: "0x0000000000000000000000000000000000000000",
          deadline: 0n,
          amount: 0n,
          validationThreshold: 70,
        }),
      ).rejects.toThrow("JobCreated event was not found");
    });
  });

  describe("submitDeliverable", () => {
    it("should call writeContract with correct args", async () => {
      const params: SubmitDeliverableParams = {
        deliverableURI: "ipfs://deliverable",
        deliverableHash: "0xbbbb000000000000000000000000000000000000000000000000000000000000",
      };

      const result = await service.submitDeliverable(FAKE_JOB_ID, params);

      expect(result).toBe(FAKE_TX_HASH);
      expect(provider.writeContract).toHaveBeenCalledWith({
        address: ESCROW_ADDRESS,
        abi: expect.any(Array),
        functionName: "submitDeliverable",
        args: [FAKE_JOB_ID, params.deliverableURI, params.deliverableHash],
      });
    });
  });

  describe("processValidation", () => {
    it("should call writeContract with jobId", async () => {
      await service.processValidation(FAKE_JOB_ID);
      expect(provider.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "processValidation",
          args: [FAKE_JOB_ID],
        }),
      );
    });
  });

  describe("confirmDelivery", () => {
    it("should call writeContract with jobId", async () => {
      await service.confirmDelivery(FAKE_JOB_ID);
      expect(provider.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "confirmDelivery",
          args: [FAKE_JOB_ID],
        }),
      );
    });
  });

  describe("settleAfterDisputeWindow", () => {
    it("should call writeContract with jobId", async () => {
      await service.settleAfterDisputeWindow(FAKE_JOB_ID);
      expect(provider.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "settleAfterDisputeWindow",
          args: [FAKE_JOB_ID],
        }),
      );
    });
  });

  describe("raiseDispute", () => {
    it("should call writeContract with correct args", async () => {
      const evidenceURI = "ipfs://evidence";
      const evidenceHash = "0xcccc000000000000000000000000000000000000000000000000000000000000" as Hex;

      await service.raiseDispute(FAKE_JOB_ID, evidenceURI, evidenceHash);

      expect(provider.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "raiseDispute",
          args: [FAKE_JOB_ID, evidenceURI, evidenceHash],
        }),
      );
    });
  });

  describe("claimTimeout", () => {
    it("should call writeContract with jobId", async () => {
      await service.claimTimeout(FAKE_JOB_ID);
      expect(provider.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "claimTimeout",
          args: [FAKE_JOB_ID],
        }),
      );
    });
  });

  // ---- Read methods ----

  describe("getJob", () => {
    it("should call readContract with getJob", async () => {
      await service.getJob(FAKE_JOB_ID);
      expect(provider.readContract).toHaveBeenCalledWith({
        address: ESCROW_ADDRESS,
        abi: expect.any(Array),
        functionName: "getJob",
        args: [FAKE_JOB_ID],
      });
    });
  });

  describe("getAgentJobs", () => {
    it("should call readContract with getAgentJobIds (not getAgentJobs)", async () => {
      await service.getAgentJobs(1n);
      expect(provider.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "getAgentJobIds",
          args: [1n],
        }),
      );
    });
  });

  describe("getAgentJobCount", () => {
    it("should call readContract with getAgentJobCount", async () => {
      await service.getAgentJobCount(1n);
      expect(provider.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "getAgentJobCount",
          args: [1n],
        }),
      );
    });
  });

  describe("jobExists", () => {
    it("should call readContract with jobExists", async () => {
      await service.jobExists(FAKE_JOB_ID);
      expect(provider.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "jobExists",
          args: [FAKE_JOB_ID],
        }),
      );
    });
  });

  describe("getProtocolStats", () => {
    it("should read both totalJobsCreated and totalVolumeSettled", async () => {
      vi.mocked(provider.readContract)
        .mockResolvedValueOnce(42n)
        .mockResolvedValueOnce(1_000_000n);

      const stats = await service.getProtocolStats();

      expect(stats).toEqual({
        totalJobsCreated: 42n,
        totalVolumeSettled: 1_000_000n,
      });
      expect(provider.readContract).toHaveBeenCalledTimes(2);
    });
  });

  // ---- Event listeners ----

  describe("onJobCreated", () => {
    it("should subscribe to JobCreated events and return unsubscribe fn", () => {
      const callback = vi.fn();
      const unsub = service.onJobCreated(callback);

      expect(provider.watchContractEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: "JobCreated",
          onLogs: callback,
        }),
      );
      expect(typeof unsub).toBe("function");
    });
  });

  describe("onJobSettled", () => {
    it("should subscribe to JobSettled events", () => {
      const callback = vi.fn();
      service.onJobSettled(callback);

      expect(provider.watchContractEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: "JobSettled" }),
      );
    });
  });

  describe("onDeliverableSubmitted", () => {
    it("should subscribe to DeliverableSubmitted events", () => {
      const callback = vi.fn();
      service.onDeliverableSubmitted(callback);

      expect(provider.watchContractEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: "DeliverableSubmitted" }),
      );
    });
  });

  // ---- Read-only guard ----

  describe("read-only guard", () => {
    it("should throw AegisValidationError for write methods when read-only", async () => {
      const roProvider = createMockProvider(true);
      const roService = new EscrowService(roProvider, createAddresses());

      await expect(() =>
        roService.createJob({
          clientAgentId: 1n,
          providerAgentId: 2n,
          jobSpecHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
          jobSpecURI: "",
          validatorAddress: "0x0000000000000000000000000000000000000000",
          deadline: 0n,
          amount: 0n,
          validationThreshold: 70,
        }),
      ).rejects.toThrow(AegisValidationError);
    });

    it("should allow read methods when read-only", async () => {
      const roProvider = createMockProvider(true);
      const roService = new EscrowService(roProvider, createAddresses());

      await roService.getJob(FAKE_JOB_ID);
      expect(roProvider.readContract).toHaveBeenCalled();
    });
  });
});
