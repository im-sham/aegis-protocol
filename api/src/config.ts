import { CHAIN_CONFIGS, type SupportedChain } from "@aegis-protocol/types";

export interface ApiConfig {
  port: number;
  chain: SupportedChain;
  rpcUrl: string;
  subgraphUrl: string;
}

export function loadConfig(): ApiConfig {
  const chain = (process.env.CHAIN ?? "base-sepolia") as SupportedChain;

  if (!CHAIN_CONFIGS[chain]) {
    throw new Error(`Unsupported chain: ${chain}. Valid: ${Object.keys(CHAIN_CONFIGS).join(", ")}`);
  }

  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error("RPC_URL environment variable is required");

  const subgraphUrl = process.env.SUBGRAPH_URL;
  if (!subgraphUrl) throw new Error("SUBGRAPH_URL environment variable is required");

  return {
    port: parseInt(process.env.PORT ?? "3000", 10),
    chain,
    rpcUrl,
    subgraphUrl,
  };
}
