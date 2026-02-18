import type { Hex } from "./contracts";

/**
 * Deployed AEGIS Protocol contract addresses for a given chain.
 */
export interface ContractAddresses {
  escrow: Hex;
  dispute: Hex;
  treasury: Hex;
  factory: Hex;
  usdc: Hex;
  identityRegistry: Hex;
  reputationRegistry: Hex;
  validationRegistry: Hex;
}

/**
 * Full chain configuration including RPC endpoint and contract addresses.
 */
export interface ChainConfig {
  chainId: number;
  rpcUrl: string;
  contracts: ContractAddresses;
}

/**
 * Chains supported by the AEGIS Protocol SDK.
 */
export type SupportedChain = "base-sepolia" | "base";

/**
 * Optional overrides when constructing the SDK client.
 */
export interface ClientOptions {
  chain: SupportedChain;
  contracts?: Partial<ContractAddresses>;
}

/**
 * Pre-configured chain configs for supported networks.
 * Base Sepolia addresses correspond to the deployed AEGIS contracts.
 */
export const CHAIN_CONFIGS: Record<SupportedChain, ChainConfig> = {
  "base-sepolia": {
    chainId: 84532,
    rpcUrl: "https://sepolia.base.org",
    contracts: {
      escrow: "0xD5140b684Ea05a9e5fB6090cb89ED53eeE22A42a",
      dispute: "0xEA82d5142557CD5B63EFDE17a0a62AC913abE4a0",
      treasury: "0x7977a4F05b2a93738b4aBb2b29328c8d0666FF2A",
      factory: "0x9A9821B35D1Cd7fC38f02daEF5BE4B1a77954a29",
      usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      identityRegistry: "0x3365f24bC393e7B8Fd7c05B2B038916D4B043167",
      reputationRegistry: "0x8f354D60D8f12bf1339DbAC02F84F0bdf292F39D",
      validationRegistry: "0x63e89bE524b338c32BFd5752e199362b77F895Ad",
    },
  },
  base: {
    chainId: 8453,
    rpcUrl: "https://mainnet.base.org",
    contracts: {
      escrow: "0x0000000000000000000000000000000000000000",
      dispute: "0x0000000000000000000000000000000000000000",
      treasury: "0x0000000000000000000000000000000000000000",
      factory: "0x0000000000000000000000000000000000000000",
      usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      identityRegistry: "0x0000000000000000000000000000000000000000",
      reputationRegistry: "0x0000000000000000000000000000000000000000",
      validationRegistry: "0x0000000000000000000000000000000000000000",
    },
  },
};
