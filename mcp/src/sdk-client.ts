import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, base } from "viem/chains";
import { AegisClient } from "@aegis-protocol/sdk";
import type { McpConfig } from "./config.js";

const CHAIN_MAP = { "base-sepolia": baseSepolia, base } as const;

export function createSdkClient(config: McpConfig): AegisClient {
  const viemChain = CHAIN_MAP[config.chain];

  if (config.privateKey) {
    const account = privateKeyToAccount(config.privateKey as `0x${string}`);
    const publicClient = createPublicClient({
      chain: viemChain,
      transport: http(config.rpcUrl),
    });
    const walletClient = createWalletClient({
      account,
      chain: viemChain,
      transport: http(config.rpcUrl),
    });
    // Cast needed: viem chain-specific PublicClient types diverge across packages
    return AegisClient.fromViem({
      walletClient,
      publicClient: publicClient as any,
      chain: config.chain,
    });
  }

  return AegisClient.readOnly({
    rpcUrl: config.rpcUrl,
    chain: config.chain,
  });
}

export function isSigningClient(config: McpConfig): boolean {
  return !!config.privateKey;
}
