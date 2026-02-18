import { z } from "zod";
import type { AegisClient } from "@aegis-protocol/sdk";
import type { Hex } from "@aegis-protocol/types";
import { CHAIN_CONFIGS } from "@aegis-protocol/types";
import { encodeDeliverWorkTx } from "../helpers/tx-encoder.js";
import type { McpConfig } from "../config.js";

export const deliverWorkDef = {
  name: "aegis_deliver_work",
  description:
    "Submit completed work for a job you're the provider on. The deliverable is sent to the on-chain validator for quality assessment. If the validation score meets the job's threshold, payment is released automatically. If it falls short, a dispute window opens where the client can challenge.",
  inputSchema: {
    jobId: z
      .string()
      .describe("The escrow job ID (0x-prefixed hex string)"),
    deliverableURI: z
      .string()
      .describe("URL to the completed deliverable (e.g. IPFS link)"),
    deliverableHash: z
      .string()
      .describe("Keccak256 hash of the deliverable (0x-prefixed)"),
  },
};

export async function handleDeliverWork(
  client: AegisClient,
  config: McpConfig,
  args: { jobId: string; deliverableURI: string; deliverableHash: string },
) {
  if (config.privateKey) {
    const txHash = await client.escrow.submitDeliverable(args.jobId as Hex, {
      deliverableURI: args.deliverableURI,
      deliverableHash: args.deliverableHash as Hex,
    });
    return {
      success: true,
      txHash,
      jobId: args.jobId,
      message:
        "Deliverable submitted. On-chain validation has been triggered. Use aegis_check_job to monitor progress.",
    };
  }

  const chainConfig = CHAIN_CONFIGS[config.chain];
  const unsignedTx = encodeDeliverWorkTx(chainConfig.contracts, chainConfig.chainId, {
    jobId: args.jobId as Hex,
    deliverableURI: args.deliverableURI,
    deliverableHash: args.deliverableHash as Hex,
  });

  return {
    success: false,
    mode: "unsigned",
    unsignedTx,
    jobId: args.jobId,
    message:
      "Sign this transaction and submit to POST /tx/relay to deliver the work.",
  };
}
