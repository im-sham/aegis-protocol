import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Hex, ContractAddresses } from "@aegis-protocol/types";
import { AegisValidationError } from "@aegis-protocol/types";
import type { AegisProvider } from "../provider";
import { IdentityService } from "../erc8004/identity";
import { ReputationService } from "../erc8004/reputation";
import { ValidationService } from "../erc8004/validation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const IDENTITY_ADDRESS = "0x6666666666666666666666666666666666666666" as Hex;
const REPUTATION_ADDRESS = "0x7777777777777777777777777777777777777777" as Hex;
const VALIDATION_ADDRESS = "0x8888888888888888888888888888888888888888" as Hex;
const FAKE_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as Hex;
const FAKE_WALLET = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as Hex;
const FAKE_REQUEST_HASH = "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex;

function createAddresses(): ContractAddresses {
  return {
    escrow: "0x1111111111111111111111111111111111111111",
    dispute: "0x2222222222222222222222222222222222222222",
    treasury: "0x3333333333333333333333333333333333333333",
    factory: "0x4444444444444444444444444444444444444444",
    usdc: "0x5555555555555555555555555555555555555555",
    identityRegistry: IDENTITY_ADDRESS,
    reputationRegistry: REPUTATION_ADDRESS,
    validationRegistry: VALIDATION_ADDRESS,
  };
}

function createMockProvider(readOnly = false): AegisProvider {
  return {
    readContract: vi.fn().mockResolvedValue(undefined),
    writeContract: vi.fn().mockResolvedValue(FAKE_TX_HASH),
    waitForTransaction: vi.fn(),
    watchContractEvent: vi.fn().mockReturnValue(() => {}),
    getAddress: vi.fn().mockResolvedValue(FAKE_WALLET),
    getChainId: vi.fn().mockResolvedValue(84532),
    isReadOnly: readOnly,
  };
}

// ---------------------------------------------------------------------------
// IdentityService Tests
// ---------------------------------------------------------------------------

describe("IdentityService", () => {
  let provider: AegisProvider;
  let service: IdentityService;

  beforeEach(() => {
    provider = createMockProvider();
    service = new IdentityService(provider, createAddresses());
  });

  // ---- Write methods ----

  describe("register", () => {
    it("should call writeContract with correct args", async () => {
      const result = await service.register("ipfs://agent-metadata");

      expect(result).toBe(FAKE_TX_HASH);
      expect(provider.writeContract).toHaveBeenCalledWith({
        address: IDENTITY_ADDRESS,
        abi: expect.any(Array),
        functionName: "register",
        args: ["ipfs://agent-metadata"],
      });
    });
  });

  // ---- Read methods ----

  describe("getAgentWallet", () => {
    it("should call readContract with correct args", async () => {
      vi.mocked(provider.readContract).mockResolvedValue(FAKE_WALLET);
      const result = await service.getAgentWallet(1n);

      expect(result).toBe(FAKE_WALLET);
      expect(provider.readContract).toHaveBeenCalledWith({
        address: IDENTITY_ADDRESS,
        abi: expect.any(Array),
        functionName: "getAgentWallet",
        args: [1n],
      });
    });
  });

  describe("ownerOf", () => {
    it("should call readContract with correct args", async () => {
      vi.mocked(provider.readContract).mockResolvedValue(FAKE_WALLET);
      const result = await service.ownerOf(1n);

      expect(result).toBe(FAKE_WALLET);
      expect(provider.readContract).toHaveBeenCalledWith({
        address: IDENTITY_ADDRESS,
        abi: expect.any(Array),
        functionName: "ownerOf",
        args: [1n],
      });
    });
  });

  // ---- Read-only guard ----

  describe("read-only guard", () => {
    it("should throw AegisValidationError for register when read-only", () => {
      const roProvider = createMockProvider(true);
      const roService = new IdentityService(roProvider, createAddresses());

      expect(() => roService.register("ipfs://test")).rejects.toThrow(
        AegisValidationError,
      );
    });

    it("should allow read methods when read-only", async () => {
      const roProvider = createMockProvider(true);
      const roService = new IdentityService(roProvider, createAddresses());

      await roService.getAgentWallet(1n);
      expect(roProvider.readContract).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// ReputationService Tests
// ---------------------------------------------------------------------------

describe("ReputationService", () => {
  let provider: AegisProvider;
  let service: ReputationService;

  beforeEach(() => {
    provider = createMockProvider();
    service = new ReputationService(provider, createAddresses());
  });

  describe("getSummary", () => {
    it("should call readContract with correct args and parse result", async () => {
      const mockResult: [bigint, bigint, number] = [5n, 85n, 2];
      vi.mocked(provider.readContract).mockResolvedValue(mockResult);

      const clientAddresses = [
        "0xaaaa000000000000000000000000000000000001" as Hex,
        "0xaaaa000000000000000000000000000000000002" as Hex,
      ];

      const result = await service.getSummary(1n, clientAddresses, "quality", "speed");

      expect(result).toEqual({
        count: 5n,
        summaryValue: 85n,
        summaryValueDecimals: 2,
      });
      expect(provider.readContract).toHaveBeenCalledWith({
        address: REPUTATION_ADDRESS,
        abi: expect.any(Array),
        functionName: "getSummary",
        args: [1n, clientAddresses, "quality", "speed"],
      });
    });

    it("should default tag1 and tag2 to empty strings", async () => {
      const mockResult: [bigint, bigint, number] = [0n, 0n, 0];
      vi.mocked(provider.readContract).mockResolvedValue(mockResult);

      await service.getSummary(1n, []);

      expect(provider.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          args: [1n, [], "", ""],
        }),
      );
    });
  });

  describe("getClients", () => {
    it("should call readContract with correct args", async () => {
      const mockClients = [FAKE_WALLET] as readonly Hex[];
      vi.mocked(provider.readContract).mockResolvedValue(mockClients);

      const result = await service.getClients(1n);

      expect(result).toEqual(mockClients);
      expect(provider.readContract).toHaveBeenCalledWith({
        address: REPUTATION_ADDRESS,
        abi: expect.any(Array),
        functionName: "getClients",
        args: [1n],
      });
    });
  });
});

// ---------------------------------------------------------------------------
// ValidationService Tests
// ---------------------------------------------------------------------------

describe("ValidationService", () => {
  let provider: AegisProvider;
  let service: ValidationService;

  beforeEach(() => {
    provider = createMockProvider();
    service = new ValidationService(provider, createAddresses());
  });

  describe("getValidationStatus", () => {
    it("should call readContract with correct args and parse result", async () => {
      const mockResult: [Hex, bigint, number, Hex, string, bigint] = [
        "0x9999999999999999999999999999999999999999" as Hex,
        1n,
        85,
        "0xbbbb000000000000000000000000000000000000000000000000000000000000" as Hex,
        "code-review",
        1700000000n,
      ];
      vi.mocked(provider.readContract).mockResolvedValue(mockResult);

      const result = await service.getValidationStatus(FAKE_REQUEST_HASH);

      expect(result).toEqual({
        validatorAddress: "0x9999999999999999999999999999999999999999",
        agentId: 1n,
        response: 85,
        responseHash: "0xbbbb000000000000000000000000000000000000000000000000000000000000",
        tag: "code-review",
        lastUpdate: 1700000000n,
      });
      expect(provider.readContract).toHaveBeenCalledWith({
        address: VALIDATION_ADDRESS,
        abi: expect.any(Array),
        functionName: "getValidationStatus",
        args: [FAKE_REQUEST_HASH],
      });
    });
  });

  describe("getAgentValidations", () => {
    it("should call readContract with correct args", async () => {
      const mockHashes = [FAKE_REQUEST_HASH] as readonly Hex[];
      vi.mocked(provider.readContract).mockResolvedValue(mockHashes);

      const result = await service.getAgentValidations(1n);

      expect(result).toEqual(mockHashes);
      expect(provider.readContract).toHaveBeenCalledWith({
        address: VALIDATION_ADDRESS,
        abi: expect.any(Array),
        functionName: "getAgentValidations",
        args: [1n],
      });
    });
  });
});
