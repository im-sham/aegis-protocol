import { CHAIN_CONFIGS, type SupportedChain } from "@aegis-protocol/types";

export interface McpConfig {
  chain: SupportedChain;
  rpcUrl: string;
  rpcUrls: string[];
  privateKey: string | undefined;
  apiUrl: string | undefined;
}

function isValidRpcUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseRpcUrlList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .filter(isValidRpcUrl);
}

function dedupePreserveOrder(values: string[]): string[] {
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

function chainSpecificRpcEnv(
  chain: SupportedChain,
  env: Record<string, string | undefined>,
): string | undefined {
  if (chain === "base-sepolia") return env.BASE_SEPOLIA_RPC_URL;
  if (chain === "base") return env.BASE_RPC_URL ?? env.BASE_MAINNET_RPC_URL;
  return undefined;
}

export function resolveRpcUrls(
  chain: SupportedChain,
  env: Record<string, string | undefined> = process.env,
): string[] {
  const chainDefault = CHAIN_CONFIGS[chain].rpcUrl;
  const candidates = [
    env.AEGIS_RPC_URL,
    ...parseRpcUrlList(env.AEGIS_RPC_URLS),
    chainSpecificRpcEnv(chain, env),
    chainDefault,
  ].filter((value): value is string => !!value && isValidRpcUrl(value));

  const rpcUrls = dedupePreserveOrder(candidates);
  if (rpcUrls.length === 0) {
    throw new Error(
      `No valid RPC URLs resolved for chain ${chain}. Set AEGIS_RPC_URL or AEGIS_RPC_URLS.`,
    );
  }
  return rpcUrls;
}

export function loadConfig(): McpConfig {
  const chain = (process.env.AEGIS_CHAIN ?? "base-sepolia") as SupportedChain;

  if (!CHAIN_CONFIGS[chain]) {
    throw new Error(
      `Unsupported chain: ${chain}. Valid: ${Object.keys(CHAIN_CONFIGS).join(", ")}`,
    );
  }

  const rpcUrls = resolveRpcUrls(chain);
  const rpcUrl = rpcUrls[0];

  return {
    chain,
    rpcUrl,
    rpcUrls,
    privateKey: process.env.AEGIS_PRIVATE_KEY,
    apiUrl: process.env.AEGIS_API_URL,
  };
}
