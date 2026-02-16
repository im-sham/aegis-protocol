import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Hex, ContractAddresses } from "@aegis-protocol/types";
import { AegisValidationError } from "@aegis-protocol/types";
import type { AegisProvider } from "../provider";
import { FactoryService } from "../factory";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FACTORY_ADDRESS = "0x4444444444444444444444444444444444444444" as Hex;
const FAKE_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as Hex;

function createAddresses(): ContractAddresses {
  return {
    escrow: "0x1111111111111111111111111111111111111111",
    dispute: "0x2222222222222222222222222222222222222222",
    treasury: "0x3333333333333333333333333333333333333333",
    factory: FACTORY_ADDRESS,
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

describe("FactoryService", () => {
  let provider: AegisProvider;
  let service: FactoryService;

  beforeEach(() => {
    provider = createMockProvider();
    service = new FactoryService(provider, createAddresses());
  });

  // ---- Write methods ----

  describe("createTemplate", () => {
    it("should call writeContract with correct args", async () => {
      const result = await service.createTemplate({
        name: "code-review",
        defaultValidator: "0x9999999999999999999999999999999999999999",
        defaultTimeout: 86400n,
        feeBps: 250n,
        minValidation: 70,
        defaultDisputeSplit: 50,
      });

      expect(result).toBe(FAKE_TX_HASH);
      expect(provider.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "createTemplate",
          args: [
            "code-review",
            "0x9999999999999999999999999999999999999999",
            86400n,
            250n,
            70,
            50,
          ],
        }),
      );
    });
  });

  describe("createJobFromTemplate", () => {
    it("should call writeContract with correct args", async () => {
      const jobSpecHash = "0xaaaa000000000000000000000000000000000000000000000000000000000000" as Hex;
      await service.createJobFromTemplate({
        templateId: 1n,
        clientAgentId: 10n,
        providerAgentId: 20n,
        jobSpecHash,
        jobSpecURI: "ipfs://spec",
        amount: 5_000_000n,
      });

      expect(provider.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "createJobFromTemplate",
          args: [1n, 10n, 20n, jobSpecHash, "ipfs://spec", 5_000_000n],
        }),
      );
    });
  });

  describe("deactivateTemplate", () => {
    it("should call writeContract with templateId", async () => {
      await service.deactivateTemplate(3n);
      expect(provider.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "deactivateTemplate",
          args: [3n],
        }),
      );
    });
  });

  // ---- Read methods ----

  describe("getTemplate", () => {
    it("should call readContract with getTemplate", async () => {
      await service.getTemplate(1n);
      expect(provider.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "getTemplate",
          args: [1n],
        }),
      );
    });
  });

  describe("isTemplateActive", () => {
    it("should call readContract with isTemplateActive", async () => {
      vi.mocked(provider.readContract).mockResolvedValue(true);
      const active = await service.isTemplateActive(1n);
      expect(active).toBe(true);
    });
  });

  // ---- Read-only guard ----

  describe("read-only guard", () => {
    it("should throw for write methods when read-only", () => {
      const roProvider = createMockProvider(true);
      const roService = new FactoryService(roProvider, createAddresses());

      expect(() =>
        roService.createTemplate({
          name: "test",
          defaultValidator: "0x0000000000000000000000000000000000000000",
          defaultTimeout: 0n,
          feeBps: 0n,
          minValidation: 0,
          defaultDisputeSplit: 0,
        }),
      ).rejects.toThrow(AegisValidationError);
    });

    it("should allow read methods when read-only", async () => {
      const roProvider = createMockProvider(true);
      const roService = new FactoryService(roProvider, createAddresses());

      await roService.getTemplate(1n);
      expect(roProvider.readContract).toHaveBeenCalled();
    });
  });
});
