import { z } from "zod";
import type { AegisClient } from "@aegis-protocol/sdk";
import { formatUSDC } from "@aegis-protocol/sdk";
import type { Hex } from "@aegis-protocol/types";

export const checkBalanceDef = {
  name: "aegis_check_balance",
  description:
    "Check an address's USDC balance and current escrow approval amount. Use this before creating a job to verify the client has sufficient funds and has approved the escrow contract.",
  inputSchema: {
    address: z
      .string()
      .describe("Ethereum address to check (0x-prefixed)"),
  },
};

export async function handleCheckBalance(
  client: AegisClient,
  args: { address: string },
) {
  const address = args.address as Hex;
  const escrowAddress = "0xe988128467299fD856Bb45D2241811837BF35E77" as Hex;

  const [balance, allowance] = await Promise.all([
    client.usdc.balanceOf(address),
    client.usdc.allowance(address, escrowAddress),
  ]);

  return {
    address: args.address,
    usdcBalance: `${formatUSDC(balance)} USDC`,
    usdcBalanceRaw: balance.toString(),
    escrowAllowance: `${formatUSDC(allowance)} USDC`,
    escrowAllowanceRaw: allowance.toString(),
    canCreateJob: balance > 0n && allowance > 0n,
  };
}
