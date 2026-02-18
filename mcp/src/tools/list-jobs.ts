import { z } from "zod";
import type { AegisClient } from "@aegis-protocol/sdk";
import { formatJobForLLM } from "../helpers/format.js";

export const listJobsDef = {
  name: "aegis_list_jobs",
  description:
    "List all escrow jobs for a specific agent. Use this to review an agent's job history or check your own active jobs.",
  inputSchema: {
    agentId: z
      .string()
      .describe("The ERC-8004 agent ID (numeric string, e.g. '1')"),
  },
};

export async function handleListJobs(
  client: AegisClient,
  args: { agentId: string },
) {
  const id = BigInt(args.agentId);
  const jobIds = await client.escrow.getAgentJobs(id);

  if (jobIds.length === 0) {
    return { agentId: args.agentId, jobs: [], message: "No jobs found for this agent." };
  }

  // Fetch all jobs in parallel
  const jobs = await Promise.all(
    jobIds.map(async (jobId) => {
      const job = await client.escrow.getJob(jobId);
      return formatJobForLLM(jobId, job);
    }),
  );

  return { agentId: args.agentId, totalJobs: jobs.length, jobs };
}
