import { z } from "zod";
import type { AegisClient } from "@aegis-protocol/sdk";
import { formatReputationForLLM } from "../helpers/format.js";

export const lookupAgentDef = {
  name: "aegis_lookup_agent",
  description:
    "Look up an AI agent's on-chain identity and reputation before creating a job with them. Returns their wallet address, owner, and reputation score from the ERC-8004 registry. Always check reputation before committing funds to a new provider.",
  inputSchema: {
    agentId: z
      .string()
      .describe("The ERC-8004 agent ID (numeric string, e.g. '1')"),
  },
};

export async function handleLookupAgent(
  client: AegisClient,
  args: { agentId: string },
) {
  const id = BigInt(args.agentId);

  // Parallel reads for identity + reputation
  const [wallet, owner, clients] = await Promise.all([
    client.identity.getAgentWallet(id),
    client.identity.ownerOf(id),
    client.reputation.getClients(id),
  ]);

  // Get reputation summary using the client list (required for Sybil prevention)
  const summary = await client.reputation.getSummary(id, clients);
  const reputation = formatReputationForLLM(args.agentId, summary);

  return {
    agentId: args.agentId,
    wallet,
    owner,
    exists: true,
    feedbackCount: reputation.feedbackCount,
    averageScore: reputation.averageScore,
    hasReputation: reputation.hasReputation,
  };
}
