import { z } from "zod";
import type { AegisClient } from "@aegis-protocol/sdk";
import { formatUSDC } from "@aegis-protocol/sdk";
import { CHAIN_CONFIGS, type Hex } from "@aegis-protocol/types";
import type { McpConfig } from "../config.js";

export const checkBalanceDef = {
  name: "aegis_check_balance",
  description:
    "Decision-support tool for escrow funding. Call this immediately before `aegis_create_job` or any escrow write path to verify the payer still has enough USDC and has approved the escrow contract. In signing mode, `address` can be omitted to inspect the connected wallet.",
  inputSchema: {
    address: z
      .string()
      .optional()
      .describe("Ethereum address to check (0x-prefixed)"),
  },
};

async function resolveAddress(
  client: AegisClient,
  args: { address?: string },
): Promise<Hex> {
  if (args.address) return args.address as Hex;
  try {
    return await client.getAddress();
  } catch {
    throw new Error(
      "Address is required for read-only clients. Pass `address` explicitly.",
    );
  }
}

export async function handleCheckBalance(
  client: AegisClient,
  config: McpConfig,
  args: { address?: string },
) {
  const address = await resolveAddress(client, args);
  const escrowAddress = CHAIN_CONFIGS[config.chain].contracts.escrow;

  const [balance, allowance] = await Promise.all([
    client.usdc.balanceOf(address),
    client.usdc.allowance(address, escrowAddress),
  ]);

  return {
    address,
    usdcBalance: `${formatUSDC(balance)} USDC`,
    usdcBalanceRaw: balance.toString(),
    escrowAllowance: `${formatUSDC(allowance)} USDC`,
    escrowAllowanceRaw: allowance.toString(),
    canCreateJob: balance > 0n && allowance > 0n,
  };
}
