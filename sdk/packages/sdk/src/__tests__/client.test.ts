import { describe, it, expect } from "vitest";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { AegisClient } from "../client";
import { EscrowService } from "../escrow";
import { DisputeService } from "../dispute";
import { TreasuryService } from "../treasury";
import { FactoryService } from "../factory";
import { IdentityService } from "../erc8004/identity";
import { ReputationService } from "../erc8004/reputation";
import { ValidationService } from "../erc8004/validation";
import { USDCService } from "../usdc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

function createTestClients() {
  const account = privateKeyToAccount(TEST_PRIVATE_KEY);
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });
  return { publicClient, walletClient };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AegisClient", () => {
  describe("fromViem", () => {
    it("should create a client with all 8 service modules", () => {
      const { publicClient, walletClient } = createTestClients();
      const client = AegisClient.fromViem({
        walletClient,
        publicClient,
        chain: "base-sepolia",
      });

      expect(client.escrow).toBeInstanceOf(EscrowService);
      expect(client.dispute).toBeInstanceOf(DisputeService);
      expect(client.treasury).toBeInstanceOf(TreasuryService);
      expect(client.factory).toBeInstanceOf(FactoryService);
      expect(client.identity).toBeInstanceOf(IdentityService);
      expect(client.reputation).toBeInstanceOf(ReputationService);
      expect(client.validation).toBeInstanceOf(ValidationService);
      expect(client.usdc).toBeInstanceOf(USDCService);
    });

    it("should accept contract address overrides", () => {
      const { publicClient, walletClient } = createTestClients();
      const customEscrow = "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF" as const;

      const client = AegisClient.fromViem({
        walletClient,
        publicClient,
        chain: "base-sepolia",
        contracts: { escrow: customEscrow },
      });

      // Client should still have all modules
      expect(client.escrow).toBeInstanceOf(EscrowService);
      expect(client.dispute).toBeInstanceOf(DisputeService);
    });

    it("should accept a custom ChainConfig object", () => {
      const { publicClient, walletClient } = createTestClients();

      const client = AegisClient.fromViem({
        walletClient,
        publicClient,
        chain: {
          chainId: 99999,
          rpcUrl: "http://localhost:8545",
          contracts: {
            escrow: "0x1111111111111111111111111111111111111111",
            dispute: "0x2222222222222222222222222222222222222222",
            treasury: "0x3333333333333333333333333333333333333333",
            factory: "0x4444444444444444444444444444444444444444",
            usdc: "0x5555555555555555555555555555555555555555",
            identityRegistry: "0x6666666666666666666666666666666666666666",
            reputationRegistry: "0x7777777777777777777777777777777777777777",
            validationRegistry: "0x8888888888888888888888888888888888888888",
          },
        },
      });

      expect(client.escrow).toBeInstanceOf(EscrowService);
    });
  });

  describe("readOnly", () => {
    it("should create a read-only client with all 8 service modules", () => {
      const client = AegisClient.readOnly({
        chain: "base-sepolia",
      });

      expect(client.escrow).toBeInstanceOf(EscrowService);
      expect(client.dispute).toBeInstanceOf(DisputeService);
      expect(client.treasury).toBeInstanceOf(TreasuryService);
      expect(client.factory).toBeInstanceOf(FactoryService);
      expect(client.identity).toBeInstanceOf(IdentityService);
      expect(client.reputation).toBeInstanceOf(ReputationService);
      expect(client.validation).toBeInstanceOf(ValidationService);
      expect(client.usdc).toBeInstanceOf(USDCService);
    });

    it("should accept a custom RPC URL", () => {
      const client = AegisClient.readOnly({
        chain: "base-sepolia",
        rpcUrl: "https://custom-rpc.example.com",
      });

      expect(client.escrow).toBeInstanceOf(EscrowService);
    });
  });

  describe("fromEthers", () => {
    it("should create a client with all 8 service modules", () => {
      // Use a minimal mock signer since ethers is not a dev dependency
      const mockSigner = { getAddress: async () => "0x1234" };

      const client = AegisClient.fromEthers({
        signer: mockSigner,
        chain: "base-sepolia",
      });

      expect(client.escrow).toBeInstanceOf(EscrowService);
      expect(client.dispute).toBeInstanceOf(DisputeService);
      expect(client.treasury).toBeInstanceOf(TreasuryService);
      expect(client.factory).toBeInstanceOf(FactoryService);
      expect(client.identity).toBeInstanceOf(IdentityService);
      expect(client.reputation).toBeInstanceOf(ReputationService);
      expect(client.validation).toBeInstanceOf(ValidationService);
      expect(client.usdc).toBeInstanceOf(USDCService);
    });
  });

  describe("error handling", () => {
    it("should throw for an unknown chain name", () => {
      const { publicClient, walletClient } = createTestClients();

      expect(() =>
        AegisClient.fromViem({
          walletClient,
          publicClient,
          chain: "unknown-chain" as any,
        }),
      ).toThrow('Unknown chain: "unknown-chain"');
    });
  });
});
