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
      escrow: "0x8e013cf23f11168B62bA2600d99166507Cbb4aAC",
      dispute: "0x9Cbe0bf5080568F56d61F4F3ef0f64909898DcB2",
      treasury: "0xCd2a996Edd6Be2992063fD2A41c0240D77c9e0AA",
      factory: "0xD6a9fafA4d1d233075D6c5de2a407942bdc29dbF",
      usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      identityRegistry: "0x587Fc182dB14b059c30f8B2b553edce62D81182d",
      reputationRegistry: "0x2f738B69484de79828C83e292F13Ad6EF523848a",
      validationRegistry: "0x4F15a4ce7db076F1A0159ce457AbB7D3a75BC0CD",
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
