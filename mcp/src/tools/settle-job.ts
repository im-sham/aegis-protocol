import { z } from "zod";
import type { AegisClient } from "@aegis-protocol/sdk";
import type { Hex } from "@aegis-protocol/types";
import { CHAIN_CONFIGS } from "@aegis-protocol/types";
import {
  encodeConfirmDeliveryTx,
  encodeSettleAfterWindowTx,
} from "../helpers/tx-encoder.js";
import type { McpConfig } from "../config.js";

export const settleJobDef = {
  name: "aegis_settle_job",
  description:
    'Settle a completed job to release payment to the provider. Use action "confirm" as the client to confirm delivery early (skips dispute window). Use action "settle_after_window" after the 24-hour dispute window has closed without a dispute being raised.',
  inputSchema: {
    jobId: z
      .string()
      .describe("The escrow job ID (0x-prefixed hex string)"),
    action: z
      .enum(["confirm", "settle_after_window"])
      .describe(
        '"confirm" = client confirms delivery early, "settle_after_window" = settle after dispute window closes',
      ),
  },
};

export async function handleSettleJob(
  client: AegisClient,
  config: McpConfig,
  args: { jobId: string; action: "confirm" | "settle_after_window" },
) {
  const jobId = args.jobId as Hex;

  if (config.privateKey) {
    const txHash =
      args.action === "confirm"
        ? await client.escrow.confirmDelivery(jobId)
        : await client.escrow.settleAfterDisputeWindow(jobId);

    return {
      success: true,
      txHash,
      jobId: args.jobId,
      action: args.action,
      message: "Job settled. Payment has been released to the provider.",
    };
  }

  const chainConfig = CHAIN_CONFIGS[config.chain];
  const unsignedTx =
    args.action === "confirm"
      ? encodeConfirmDeliveryTx(chainConfig.contracts, chainConfig.chainId, jobId)
      : encodeSettleAfterWindowTx(chainConfig.contracts, chainConfig.chainId, jobId);

  return {
    success: false,
    mode: "unsigned",
    unsignedTx,
    jobId: args.jobId,
    action: args.action,
    message: "Sign this transaction and submit to POST /tx/relay to settle the job.",
  };
}
