import {
  createPublicClient,
  http,
  webSocket,
  parseTransaction,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
} from "viem";
import { baseSepolia, base } from "viem/chains";

const CHAIN_MAP = { "base-sepolia": baseSepolia, base } as const;

export interface DecodedTxInfo {
  to: string | null;
  chainId: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateSignedTransaction(
  decoded: DecodedTxInfo,
  whitelist: Set<string>,
  expectedChainId: number,
): ValidationResult {
  if (!decoded.to) {
    return { valid: false, error: "Contract creation transactions are not allowed" };
  }

  if (decoded.chainId !== expectedChainId) {
    return {
      valid: false,
      error: `Wrong chain ID: got ${decoded.chainId}, expected ${expectedChainId}`,
    };
  }

  if (!whitelist.has(decoded.to.toLowerCase())) {
    return {
      valid: false,
      error: `Target ${decoded.to} is not an AEGIS contract`,
    };
  }

  return { valid: true };
}

export function decodeRawTransaction(signedTx: Hex): DecodedTxInfo {
  const parsed = parseTransaction(signedTx);
  return {
    to: parsed.to ?? null,
    chainId: parsed.chainId ? Number(parsed.chainId) : 0,
  };
}

export async function broadcastTransaction(
  rpcUrl: string,
  chain: keyof typeof CHAIN_MAP,
  signedTx: Hex,
  wait: boolean,
): Promise<{
  txHash: Hex;
  receipt?: TransactionReceipt;
}> {
  const transport = rpcUrl.startsWith("ws") ? webSocket(rpcUrl) : http(rpcUrl);
  const client = createPublicClient({ chain: CHAIN_MAP[chain], transport });

  const txHash = await client.sendRawTransaction({ serializedTransaction: signedTx });

  if (!wait) {
    return { txHash };
  }

  const receipt = await client.waitForTransactionReceipt({ hash: txHash });
  return { txHash, receipt };
}
