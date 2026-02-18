import { Hono } from "hono";
import type { AegisClient } from "@aegis-protocol/sdk";

export function createAgentRoutes(sdk?: AegisClient): Hono {
  const router = new Hono();

  router.get("/:id/wallet", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const agentId = BigInt(c.req.param("id"));
    const wallet = await sdk.identity.getAgentWallet(agentId);
    return c.json({ agentId: agentId.toString(), wallet });
  });

  router.get("/:id/owner", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const agentId = BigInt(c.req.param("id"));
    const owner = await sdk.identity.ownerOf(agentId);
    return c.json({ agentId: agentId.toString(), owner });
  });

  router.get("/:id/reputation", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const agentId = BigInt(c.req.param("id"));
    const clientsParam = c.req.query("clients") ?? "";
    const clients = clientsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) as `0x${string}`[];
    const summary = await sdk.reputation.getSummary(agentId, clients);
    return c.json({
      agentId: agentId.toString(),
      count: summary.count.toString(),
      summaryValue: summary.summaryValue.toString(),
      summaryValueDecimals: summary.summaryValueDecimals,
    });
  });

  router.get("/:id/reputation/clients", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const agentId = BigInt(c.req.param("id"));
    const clients = await sdk.reputation.getClients(agentId);
    return c.json({ agentId: agentId.toString(), clients });
  });

  router.get("/:id/jobs", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const agentId = BigInt(c.req.param("id"));
    const jobs = await sdk.escrow.getAgentJobs(agentId);
    return c.json({ agentId: agentId.toString(), jobs });
  });

  router.get("/:id/jobs/count", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const agentId = BigInt(c.req.param("id"));
    const count = await sdk.escrow.getAgentJobCount(agentId);
    return c.json({ agentId: agentId.toString(), count: count.toString() });
  });

  router.get("/:id/validations", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const agentId = BigInt(c.req.param("id"));
    const validations = await sdk.validation.getAgentValidations(agentId);
    return c.json({ agentId: agentId.toString(), validations });
  });

  return router;
}
