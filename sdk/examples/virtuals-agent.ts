/**
 * AEGIS Protocol — Virtuals GAME/ACP Example
 *
 * This file exports a minimal Virtuals-friendly config snippet that wires in the
 * AEGIS GAME worker and prints a summary when run directly.
 *
 * Usage:
 *   npx -y pnpm@9.15.4 -C sdk --filter @aegis-protocol/examples virtuals-agent
 */

import { fileURLToPath } from "node:url";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import { createPublicClient, createWalletClient, fallback, http } from "viem";
import { AegisClient, CHAIN_CONFIGS, type SupportedChain } from "@aegis-protocol/sdk";
import {
  createAegisAcpResources,
  createAegisAcpSchemas,
  createAegisVirtualsPrompt,
  createAegisVirtualsWorker,
} from "@aegis-protocol/virtuals";

const CHAIN_MAP = {
  "base-sepolia": baseSepolia,
  base,
} as const;

function dedupePreserveOrder(values: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      output.push(value);
    }
  }
  return output;
}

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

function resolveRpcUrls(chain: SupportedChain): string[] {
  return dedupePreserveOrder(
    [
      process.env.AEGIS_RPC_URL,
      process.env.BASE_SEPOLIA_RPC_URL_PRIMARY,
      process.env.BASE_SEPOLIA_RPC_URL_SECONDARY,
      process.env.BASE_RPC_URL,
      process.env.BASE_MAINNET_RPC_URL,
      ...(process.env.AEGIS_RPC_URLS?.split(",") ?? []),
      CHAIN_CONFIGS[chain].rpcUrl,
    ]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value)),
  );
}

function createClient(chain: SupportedChain) {
  const rpcUrls = resolveRpcUrls(chain);
  const transport = buildTransport(rpcUrls);
  const privateKey = process.env.AEGIS_PRIVATE_KEY as `0x${string}` | undefined;

  if (!privateKey) {
    return AegisClient.readOnly({ chain, rpcUrls });
  }

  const account = privateKeyToAccount(privateKey);
  const viemChain = CHAIN_MAP[chain];
  const publicClient = createPublicClient({
    chain: viemChain,
    transport,
  });
  const walletClient = createWalletClient({
    account,
    chain: viemChain,
    transport,
  });

  return AegisClient.fromViem({
    chain,
    publicClient,
    walletClient,
  });
}

const chain = (process.env.AEGIS_CHAIN as SupportedChain | undefined) ?? "base-sepolia";
const thresholdUsd = Number(process.env.AEGIS_VIRTUALS_THRESHOLD_USD ?? 50);
const docsUrl =
  process.env.AEGIS_DOCS_URL ??
  "https://github.com/im-sham/aegis-protocol/blob/main/content/agent-promotion-playbook.md";
const repoUrl =
  process.env.AEGIS_REPO_URL ?? "https://github.com/im-sham/aegis-protocol";
const mcpUrl =
  process.env.AEGIS_MCP_URL ?? "https://www.npmjs.com/package/@aegis-protocol/mcp-server";

const aegisClient = createClient(chain);
const writeEnabled = Boolean(process.env.AEGIS_PRIVATE_KEY);
const worker = createAegisVirtualsWorker({
  client: aegisClient,
  chain,
  enableWriteFunctions: writeEnabled,
});

export const aegisVirtualsAgentConfig = {
  name: "AEGIS Virtuals Escrow Operator",
  goal: "Protect high-value ACP and GAME workflows with escrow, validation, and trustworthy settlement.",
  description: createAegisVirtualsPrompt({ thresholdUsd }),
  workers: [worker],
  acp: {
    resources: createAegisAcpResources({ thresholdUsd, repoUrl, docsUrl, mcpUrl }),
    schemas: createAegisAcpSchemas(),
  },
  metadata: {
    chain,
    rpcUrls: resolveRpcUrls(chain),
    mode: writeEnabled ? "read-write" : "read-only",
  },
};

function main() {
  console.log(`Mode: ${writeEnabled ? "read-write" : "read-only"}`);
  console.log("Virtuals AEGIS config summary:\n");
  console.log(
    JSON.stringify(
      {
        name: aegisVirtualsAgentConfig.name,
        goal: aegisVirtualsAgentConfig.goal,
        worker: {
          id: worker.id,
          name: worker.name,
          functions: worker.functions.map((fn) => fn.name),
        },
        acp: aegisVirtualsAgentConfig.acp,
        metadata: aegisVirtualsAgentConfig.metadata,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
