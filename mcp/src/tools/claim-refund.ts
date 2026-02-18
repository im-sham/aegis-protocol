import { z } from "zod";
import type { AegisClient } from "@aegis-protocol/sdk";
import type { Hex } from "@aegis-protocol/types";
import { CHAIN_CONFIGS } from "@aegis-protocol/types";
import { encodeClaimTimeoutTx } from "../helpers/tx-encoder.js";
import type { McpConfig } from "../config.js";

export const claimRefundDef = {
  name: "aegis_claim_refund",
  description:
    "Claim a refund on an escrow job where the provider missed the deadline without delivering work. The full USDC amount is returned to the client. Only callable after the job deadline has passed.",
  inputSchema: {
    jobId: z
      .string()
      .describe("The escrow job ID (0x-prefixed hex string)"),
  },
};

export async function handleClaimRefund(
  client: AegisClient,
  config: McpConfig,
  args: { jobId: string },
) {
  if (config.privateKey) {
    const txHash = await client.escrow.claimTimeout(args.jobId as Hex);
    return {
      success: true,
      txHash,
      jobId: args.jobId,
      message: "Refund claimed. The full USDC amount has been returned to the client.",
    };
  }

  const chainConfig = CHAIN_CONFIGS[config.chain];
  const unsignedTx = encodeClaimTimeoutTx(
    chainConfig.contracts,
    chainConfig.chainId,
    args.jobId as Hex,
  );

  return {
    success: false,
    mode: "unsigned",
    unsignedTx,
    jobId: args.jobId,
    message: "Sign this transaction and submit to POST /tx/relay to claim the refund.",
  };
}
