import { z } from "zod";
import type { AegisClient } from "@aegis-protocol/sdk";
import type { Hex } from "@aegis-protocol/types";
import { CHAIN_CONFIGS } from "@aegis-protocol/types";
import { encodeRaiseDisputeTx } from "../helpers/tx-encoder.js";
import type { McpConfig } from "../config.js";

export const openDisputeDef = {
  name: "aegis_open_dispute",
  description:
    "Open a dispute when the delivered work doesn't meet the job requirements. This must be done during the dispute window (24 hours after validation). A 10 USDC dispute bond is required. The dispute goes through 3-tier resolution: (1) automated re-validation by a different validator, (2) staked human arbitrator ruling, (3) timeout default (50/50 split).",
  inputSchema: {
    jobId: z
      .string()
      .describe("The escrow job ID (0x-prefixed hex string)"),
    evidenceURI: z
      .string()
      .describe("URL to evidence supporting the dispute claim"),
    evidenceHash: z
      .string()
      .describe("Keccak256 hash of the evidence (0x-prefixed)"),
  },
};

export async function handleOpenDispute(
  client: AegisClient,
  config: McpConfig,
  args: { jobId: string; evidenceURI: string; evidenceHash: string },
) {
  if (config.privateKey) {
    const txHash = await client.escrow.raiseDispute(
      args.jobId as Hex,
      args.evidenceURI,
      args.evidenceHash as Hex,
    );
    return {
      success: true,
      txHash,
      jobId: args.jobId,
      message:
        "Dispute initiated. 10 USDC bond locked. The dispute will go through 3-tier resolution. Use aegis_check_job to monitor progress.",
    };
  }

  const chainConfig = CHAIN_CONFIGS[config.chain];
  const unsignedTx = encodeRaiseDisputeTx(
    chainConfig.contracts,
    chainConfig.chainId,
    {
      jobId: args.jobId as Hex,
      evidenceURI: args.evidenceURI,
      evidenceHash: args.evidenceHash as Hex,
    },
  );

  return {
    success: false,
    mode: "unsigned",
    unsignedTx,
    jobId: args.jobId,
    message:
      "Sign this transaction and submit to POST /tx/relay to open the dispute. Requires 10 USDC dispute bond (approve dispute contract first).",
  };
}
