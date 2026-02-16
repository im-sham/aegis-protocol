import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Hex, ContractAddresses } from "@aegis-protocol/types";
import { AegisValidationError } from "@aegis-protocol/types";
import type { AegisProvider } from "../provider";
import { DisputeService } from "../dispute";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DISPUTE_ADDRESS = "0x2222222222222222222222222222222222222222" as Hex;
const FAKE_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as Hex;
const FAKE_DISPUTE_ID = "0x0000000000000000000000000000000000000000000000000000000000000099" as Hex;
const FAKE_JOB_ID = "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex;

function createAddresses(): ContractAddresses {
  return {
    escrow: "0x1111111111111111111111111111111111111111",
    dispute: DISPUTE_ADDRESS,
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

describe("DisputeService", () => {
  let provider: AegisProvider;
  let service: DisputeService;

  beforeEach(() => {
    provider = createMockProvider();
    service = new DisputeService(provider, createAddresses());
  });

  // ---- Write methods ----

  describe("stakeAsArbitrator", () => {
    it("should call writeContract with correct args", async () => {
      const result = await service.stakeAsArbitrator(1_000_000_000n);
      expect(result).toBe(FAKE_TX_HASH);
      expect(provider.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "stakeAsArbitrator",
          args: [1_000_000_000n],
        }),
      );
    });
  });

  describe("unstakeArbitrator", () => {
    it("should call writeContract with correct args", async () => {
      await service.unstakeArbitrator(500_000_000n);
      expect(provider.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "unstakeArbitrator",
          args: [500_000_000n],
        }),
      );
    });
  });

  describe("submitEvidence", () => {
    it("should call writeContract with correct args", async () => {
      const evidenceHash = "0xdddd000000000000000000000000000000000000000000000000000000000000" as Hex;
      await service.submitEvidence(FAKE_DISPUTE_ID, "ipfs://evidence", evidenceHash);
      expect(provider.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "submitEvidence",
          args: [FAKE_DISPUTE_ID, "ipfs://evidence", evidenceHash],
        }),
      );
    });
  });

  describe("assignArbitrator", () => {
    it("should call writeContract with disputeId", async () => {
      await service.assignArbitrator(FAKE_DISPUTE_ID);
      expect(provider.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "assignArbitrator",
          args: [FAKE_DISPUTE_ID],
        }),
      );
    });
  });

  describe("resolveByArbitrator", () => {
    it("should call writeContract with correct args", async () => {
      const rationaleHash = "0xeeee000000000000000000000000000000000000000000000000000000000000" as Hex;
      await service.resolveByArbitrator(FAKE_DISPUTE_ID, {
        clientPercent: 60,
        rationaleURI: "ipfs://rationale",
        rationaleHash,
      });
      expect(provider.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "resolveByArbitrator",
          args: [FAKE_DISPUTE_ID, 60, "ipfs://rationale", rationaleHash],
        }),
      );
    });
  });

  describe("resolveByTimeout", () => {
    it("should call writeContract with disputeId", async () => {
      await service.resolveByTimeout(FAKE_DISPUTE_ID);
      expect(provider.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "resolveByTimeout",
          args: [FAKE_DISPUTE_ID],
        }),
      );
    });
  });

  // ---- Read methods ----

  describe("getDispute", () => {
    it("should call readContract with getDispute", async () => {
      await service.getDispute(FAKE_DISPUTE_ID);
      expect(provider.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "getDispute",
          args: [FAKE_DISPUTE_ID],
        }),
      );
    });
  });

  describe("getDisputeForJob", () => {
    it("should call readContract with getDisputeForJob", async () => {
      await service.getDisputeForJob(FAKE_JOB_ID);
      expect(provider.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "getDisputeForJob",
          args: [FAKE_JOB_ID],
        }),
      );
    });
  });

  describe("getActiveArbitratorCount", () => {
    it("should call readContract with getActiveArbitratorCount", async () => {
      vi.mocked(provider.readContract).mockResolvedValue(5n);
      const count = await service.getActiveArbitratorCount();
      expect(count).toBe(5n);
    });
  });

  describe("getArbitratorStats", () => {
    it("should call readContract with correct args", async () => {
      const arbAddress = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" as Hex;
      await service.getArbitratorStats(arbAddress);
      expect(provider.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "getArbitratorStats",
          args: [arbAddress],
        }),
      );
    });
  });

  // ---- Event listeners ----

  describe("onDisputeResolved", () => {
    it("should subscribe to DisputeResolved events", () => {
      const callback = vi.fn();
      const unsub = service.onDisputeResolved(callback);

      expect(provider.watchContractEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: "DisputeResolved",
          onLogs: callback,
        }),
      );
      expect(typeof unsub).toBe("function");
    });
  });

  describe("onArbitratorAssigned", () => {
    it("should subscribe to ArbitratorAssigned events", () => {
      const callback = vi.fn();
      service.onArbitratorAssigned(callback);

      expect(provider.watchContractEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: "ArbitratorAssigned" }),
      );
    });
  });

  // ---- Read-only guard ----

  describe("read-only guard", () => {
    it("should throw for write methods when read-only", () => {
      const roProvider = createMockProvider(true);
      const roService = new DisputeService(roProvider, createAddresses());

      expect(() => roService.stakeAsArbitrator(1n)).rejects.toThrow(AegisValidationError);
      expect(() => roService.submitEvidence(FAKE_DISPUTE_ID, "", "0x0000000000000000000000000000000000000000000000000000000000000000")).rejects.toThrow(AegisValidationError);
    });

    it("should allow read methods when read-only", async () => {
      const roProvider = createMockProvider(true);
      const roService = new DisputeService(roProvider, createAddresses());

      await roService.getDispute(FAKE_DISPUTE_ID);
      expect(roProvider.readContract).toHaveBeenCalled();
    });
  });
});
