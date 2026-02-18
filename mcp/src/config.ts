import { CHAIN_CONFIGS, type SupportedChain } from "@aegis-protocol/types";

export interface McpConfig {
  chain: SupportedChain;
  rpcUrl: string;
  privateKey: string | undefined;
  apiUrl: string | undefined;
}

export function loadConfig(): McpConfig {
  const chain = (process.env.AEGIS_CHAIN ?? "base-sepolia") as SupportedChain;

  if (!CHAIN_CONFIGS[chain]) {
    throw new Error(
      `Unsupported chain: ${chain}. Valid: ${Object.keys(CHAIN_CONFIGS).join(", ")}`,
    );
  }

  const rpcUrl =
    process.env.AEGIS_RPC_URL ?? CHAIN_CONFIGS[chain].rpcUrl;

  return {
    chain,
    rpcUrl,
    privateKey: process.env.AEGIS_PRIVATE_KEY,
    apiUrl: process.env.AEGIS_API_URL,
  };
}
