import { createPublicClient, createWalletClient, http, fallback } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, base } from "viem/chains";
import { AegisClient } from "@aegis-protocol/sdk";
import type { McpConfig } from "./config.js";

const CHAIN_MAP = { "base-sepolia": baseSepolia, base } as const;

function buildTransport(rpcUrls: string[]) {
  const transports = rpcUrls.map((rpcUrl) =>
    http(rpcUrl, {
      timeout: 20_000,
      retryCount: 1,
      retryDelay: 300,
    }),
  );
  return transports.length === 1 ? transports[0] : fallback(transports);
}

export function createSdkClient(config: McpConfig): AegisClient {
  const viemChain = CHAIN_MAP[config.chain];
  const rpcUrls = config.rpcUrls.length > 0 ? config.rpcUrls : [config.rpcUrl];

  if (config.privateKey) {
    const account = privateKeyToAccount(config.privateKey as `0x${string}`);
    const publicClient = createPublicClient({
      chain: viemChain,
      transport: buildTransport(rpcUrls),
    });
    const walletClient = createWalletClient({
      account,
      chain: viemChain,
      transport: buildTransport(rpcUrls),
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
    rpcUrls,
    chain: config.chain,
  });
}

export function isSigningClient(config: McpConfig): boolean {
  return !!config.privateKey;
}
