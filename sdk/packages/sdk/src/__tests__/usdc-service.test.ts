import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Hex, ContractAddresses } from "@aegis-protocol/types";
import { AegisValidationError } from "@aegis-protocol/types";
import type { AegisProvider } from "../provider";
import { USDCService } from "../usdc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Hex;
const FAKE_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as Hex;
const WALLET = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as Hex;

function createAddresses(): ContractAddresses {
  return {
    escrow: "0x1111111111111111111111111111111111111111",
    dispute: "0x2222222222222222222222222222222222222222",
    treasury: "0x3333333333333333333333333333333333333333",
    factory: "0x4444444444444444444444444444444444444444",
    usdc: USDC_ADDRESS,
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
    getAddress: vi.fn().mockResolvedValue(WALLET),
    getChainId: vi.fn().mockResolvedValue(84532),
    isReadOnly: readOnly,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("USDCService", () => {
  let provider: AegisProvider;
  let service: USDCService;

  beforeEach(() => {
    provider = createMockProvider();
    service = new USDCService(provider, createAddresses());
  });

  // ---- approveEscrow ----

  describe("approveEscrow", () => {
    it("should call writeContract with escrow address as spender", async () => {
      const hash = await service.approveEscrow(10_000_000n);
      expect(hash).toBe(FAKE_TX_HASH);
      expect(provider.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: USDC_ADDRESS,
          functionName: "approve",
          args: ["0x1111111111111111111111111111111111111111", 10_000_000n],
        }),
      );
    });

    it("should throw AegisValidationError when read-only", async () => {
      const roService = new USDCService(createMockProvider(true), createAddresses());
      await expect(roService.approveEscrow(1n)).rejects.toThrow(AegisValidationError);
    });
  });

  // ---- approveDispute ----

  describe("approveDispute", () => {
    it("should call writeContract with dispute address as spender", async () => {
      const hash = await service.approveDispute(1_000_000_000n);
      expect(hash).toBe(FAKE_TX_HASH);
      expect(provider.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "approve",
          args: ["0x2222222222222222222222222222222222222222", 1_000_000_000n],
        }),
      );
    });
  });

  // ---- approve (generic) ----

  describe("approve", () => {
    it("should approve an arbitrary spender", async () => {
      const spender = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" as Hex;
      await service.approve(spender, 5_000_000n);
      expect(provider.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: USDC_ADDRESS,
          functionName: "approve",
          args: [spender, 5_000_000n],
        }),
      );
    });

    it("should throw AegisValidationError when read-only", async () => {
      const roService = new USDCService(createMockProvider(true), createAddresses());
      const spender = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" as Hex;
      await expect(roService.approve(spender, 1n)).rejects.toThrow(AegisValidationError);
    });
  });

  // ---- balanceOf ----

  describe("balanceOf", () => {
    it("should read USDC balance for a given address", async () => {
      vi.mocked(provider.readContract).mockResolvedValue(50_000_000n);
      const balance = await service.balanceOf(WALLET);
      expect(balance).toBe(50_000_000n);
      expect(provider.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: USDC_ADDRESS,
          functionName: "balanceOf",
          args: [WALLET],
        }),
      );
    });

    it("should work when provider is read-only", async () => {
      const roProvider = createMockProvider(true);
      vi.mocked(roProvider.readContract).mockResolvedValue(99_000_000n);
      const roService = new USDCService(roProvider, createAddresses());
      const balance = await roService.balanceOf(WALLET);
      expect(balance).toBe(99_000_000n);
    });
  });

  // ---- allowance ----

  describe("allowance", () => {
    it("should read USDC allowance for owner/spender pair", async () => {
      vi.mocked(provider.readContract).mockResolvedValue(10_000_000n);
      const spender = "0x1111111111111111111111111111111111111111" as Hex;
      const allow = await service.allowance(WALLET, spender);
      expect(allow).toBe(10_000_000n);
      expect(provider.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: USDC_ADDRESS,
          functionName: "allowance",
          args: [WALLET, spender],
        }),
      );
    });
  });

  // ---- myBalance ----

  describe("myBalance", () => {
    it("should resolve the connected wallet then read its balance", async () => {
      vi.mocked(provider.readContract).mockResolvedValue(25_000_000n);
      const balance = await service.myBalance();
      expect(balance).toBe(25_000_000n);
      expect(provider.getAddress).toHaveBeenCalled();
      expect(provider.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "balanceOf",
          args: [WALLET],
        }),
      );
    });
  });

  // ---- escrowAllowance ----

  describe("escrowAllowance", () => {
    it("should read allowance granted to the escrow contract", async () => {
      vi.mocked(provider.readContract).mockResolvedValue(10_000_000n);
      const allow = await service.escrowAllowance();
      expect(allow).toBe(10_000_000n);
      expect(provider.getAddress).toHaveBeenCalled();
      expect(provider.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "allowance",
          args: [WALLET, "0x1111111111111111111111111111111111111111"],
        }),
      );
    });
  });

  // ---- disputeAllowance ----

  describe("disputeAllowance", () => {
    it("should read allowance granted to the dispute contract", async () => {
      vi.mocked(provider.readContract).mockResolvedValue(5_000_000n);
      const allow = await service.disputeAllowance();
      expect(allow).toBe(5_000_000n);
      expect(provider.getAddress).toHaveBeenCalled();
      expect(provider.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "allowance",
          args: [WALLET, "0x2222222222222222222222222222222222222222"],
        }),
      );
    });
  });

  // ---- read-only guard summary ----

  describe("read-only guard", () => {
    it("should allow all read methods when provider is read-only", async () => {
      const roProvider = createMockProvider(true);
      const roService = new USDCService(roProvider, createAddresses());

      await roService.balanceOf(WALLET);
      await roService.allowance(WALLET, "0x1111111111111111111111111111111111111111" as Hex);
      await roService.myBalance();
      await roService.escrowAllowance();
      await roService.disputeAllowance();

      expect(roProvider.readContract).toHaveBeenCalledTimes(5);
    });

    it("should throw for all write methods when provider is read-only", async () => {
      const roProvider = createMockProvider(true);
      const roService = new USDCService(roProvider, createAddresses());

      await expect(roService.approveEscrow(1n)).rejects.toThrow(AegisValidationError);
      await expect(roService.approveDispute(1n)).rejects.toThrow(AegisValidationError);
      await expect(roService.approve("0x0000000000000000000000000000000000000000" as Hex, 1n)).rejects.toThrow(AegisValidationError);
    });
  });
});
