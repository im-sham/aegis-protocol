import { Hono } from "hono";
import type { AegisClient } from "@aegis-protocol/sdk";
import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { JOB_FIELDS } from "../services/subgraph.js";

export function createJobRoutes(sdk?: AegisClient, subgraph?: GraphQLClient): Hono {
  const router = new Hono();

  // GET /jobs/:id — contract state
  router.get("/:id", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const jobId = c.req.param("id") as `0x${string}`;
    const job = await sdk.escrow.getJob(jobId);
    return c.json(job);
  });

  // GET /jobs/:id/history — subgraph events
  router.get("/:id/history", async (c) => {
    if (!subgraph) return c.json({ error: "Subgraph not initialized" }, 503);
    const jobId = c.req.param("id");
    const query = gql`
      query JobHistory($jobId: Bytes!) {
        job(id: $jobId) {
          ${JOB_FIELDS}
        }
        jobCreatedEvents(where: { jobId: $jobId }, orderBy: blockTimestamp) {
          blockNumber blockTimestamp transactionHash
          jobId clientAgentId providerAgentId amount
        }
        jobSettledEvents(where: { jobId: $jobId }) {
          blockNumber blockTimestamp transactionHash
          jobId providerWallet providerAmount protocolFee
        }
      }
    `;
    const data = await subgraph.request(query, { jobId });
    return c.json(data);
  });

  // GET /jobs — filterable list via subgraph
  router.get("/", async (c) => {
    if (!subgraph) return c.json({ error: "Subgraph not initialized" }, 503);
    const first = parseInt(c.req.query("first") ?? "20", 10);
    const skip = parseInt(c.req.query("skip") ?? "0", 10);
    const state = c.req.query("state");

    const where = state ? `where: { state: "${state}" }` : "";

    const query = gql`
      query Jobs {
        jobs(first: ${first}, skip: ${skip}, orderBy: createdAt, orderDirection: desc, ${where}) {
          ${JOB_FIELDS}
        }
      }
    `;
    const data = await subgraph.request(query);
    return c.json(data);
  });

  return router;
}
