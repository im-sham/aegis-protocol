import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Hex, ContractAddresses } from "@aegis-protocol/types";
import { AegisValidationError } from "@aegis-protocol/types";
import type { AegisProvider } from "../provider";
import { TreasuryService } from "../treasury";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TREASURY_ADDRESS = "0x3333333333333333333333333333333333333333" as Hex;
const FAKE_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as Hex;

function createAddresses(): ContractAddresses {
  return {
    escrow: "0x1111111111111111111111111111111111111111",
    dispute: "0x2222222222222222222222222222222222222222",
    treasury: TREASURY_ADDRESS,
    factory: "0x4444444444444444444444444444444444444444",
    usdc: "0x5555555555555555555555555555555555555555",
    identityRegistry: "0x6666666666666666666666666666666666666666",
    reputationRegistry: "0x7777777777777777777777777777777777777777",
    validationRegistry: "0x8888888888888888888888888888888888888888",
  };
}

function createMockProvider(readOnly = false): AegisProvider {
  return {
    readContract: vi.fn().mockResolvedValue(0n),
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

describe("TreasuryService", () => {
  let provider: AegisProvider;
  let service: TreasuryService;

  beforeEach(() => {
    provider = createMockProvider();
    service = new TreasuryService(provider, createAddresses());
  });

  // ---- Read methods ----

  describe("totalBalance", () => {
    it("should call readContract with totalBalance", async () => {
      vi.mocked(provider.readContract).mockResolvedValue(100_000_000n);
      const balance = await service.totalBalance();
      expect(balance).toBe(100_000_000n);
      expect(provider.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: TREASURY_ADDRESS,
          functionName: "totalBalance",
        }),
      );
    });
  });

  describe("getBalances", () => {
    it("should read all three balance state vars via Promise.all", async () => {
      vi.mocked(provider.readContract)
        .mockResolvedValueOnce(500_000n) // totalFeesCollected
        .mockResolvedValueOnce(350_000n) // treasuryBalance
        .mockResolvedValueOnce(150_000n); // arbitratorPoolBalance

      const balances = await service.getBalances();

      expect(balances).toEqual({
        totalFeesCollected: 500_000n,
        treasuryBalance: 350_000n,
        arbitratorPoolBalance: 150_000n,
      });
      expect(provider.readContract).toHaveBeenCalledTimes(3);
    });
  });

  // ---- Write methods ----

  describe("withdrawTreasury", () => {
    it("should call writeContract with correct args", async () => {
      const to = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" as Hex;
      await service.withdrawTreasury(to, 50_000n);
      expect(provider.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "withdrawTreasury",
          args: [to, 50_000n],
        }),
      );
    });
  });

  describe("distributeArbitratorRewards", () => {
    it("should call writeContract with correct args", async () => {
      const disputeContract = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" as Hex;
      await service.distributeArbitratorRewards(disputeContract, 25_000n);
      expect(provider.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "distributeArbitratorRewards",
          args: [disputeContract, 25_000n],
        }),
      );
    });
  });

  describe("sweep", () => {
    it("should call writeContract with no args", async () => {
      await service.sweep();
      expect(provider.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "sweep",
        }),
      );
    });
  });

  // ---- Read-only guard ----

  describe("read-only guard", () => {
    it("should throw for write methods when read-only", async () => {
      const roProvider = createMockProvider(true);
      const roService = new TreasuryService(roProvider, createAddresses());

      await expect(() => roService.withdrawTreasury("0x0000000000000000000000000000000000000000", 1n)).rejects.toThrow(AegisValidationError);
      await expect(() => roService.sweep()).rejects.toThrow(AegisValidationError);
    });

    it("should allow read methods when read-only", async () => {
      const roProvider = createMockProvider(true);
      const roService = new TreasuryService(roProvider, createAddresses());

      await roService.totalBalance();
      expect(roProvider.readContract).toHaveBeenCalled();
    });
  });
});
