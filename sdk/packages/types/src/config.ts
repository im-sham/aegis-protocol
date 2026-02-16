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
      escrow: "0xe988128467299fD856Bb45D2241811837BF35E77",
      dispute: "0x2c831D663B87194Fa6444df17A9A7d135186Cb41",
      treasury: "0xE64D271a863aa1438FBb36Bd1F280FA1F499c3f5",
      factory: "0xFD451BEfa1eE3EB4dBCA4E9EA539B4bf432866dA",
      usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      identityRegistry: "0xc67ed2b93a4B05c35872fBB15c199Ee30ce4300D",
      reputationRegistry: "0x760b4605371faE6097AcD2dcd8ca93dd5FfF9c84",
      validationRegistry: "0xB9D5B30a207429E95ea7E055fbA6D9d6b7Ba632b",
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
