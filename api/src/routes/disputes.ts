import { Hono } from "hono";
import type { AegisClient } from "@aegis-protocol/sdk";
import type { GraphQLClient } from "graphql-request";

export function createDisputeRoutes(sdk?: AegisClient, subgraph?: GraphQLClient): Hono {
  const router = new Hono();

  router.get("/:id", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const disputeId = c.req.param("id") as `0x${string}`;
    const dispute = await sdk.dispute.getDispute(disputeId);
    return c.json(dispute);
  });

  router.get("/job/:jobId", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const jobId = c.req.param("jobId") as `0x${string}`;
    const disputeId = await sdk.dispute.getDisputeForJob(jobId);
    return c.json({ disputeId });
  });

  return router;
}
