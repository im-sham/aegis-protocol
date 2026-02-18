import { z } from "zod";
import type { AegisClient } from "@aegis-protocol/sdk";
import type { Hex } from "@aegis-protocol/types";
import { formatJobForLLM } from "../helpers/format.js";

export const checkJobDef = {
  name: "aegis_check_job",
  description:
    "Check the current state of an escrow job — whether it's funded, delivered, in validation, settled, or disputed. Use this to monitor job progress before taking your next action.",
  inputSchema: {
    jobId: z
      .string()
      .describe("The escrow job ID (0x-prefixed hex string)"),
  },
};

export async function handleCheckJob(
  client: AegisClient,
  args: { jobId: string },
) {
  const job = await client.escrow.getJob(args.jobId as Hex);
  return formatJobForLLM(args.jobId, job);
}
