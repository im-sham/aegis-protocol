import { Hono } from "hono";
import type { AegisClient } from "@aegis-protocol/sdk";

export function createUsdcRoutes(sdk?: AegisClient): Hono {
  const router = new Hono();

  router.get("/balance/:address", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const address = c.req.param("address") as `0x${string}`;
    const balance = await sdk.usdc.balanceOf(address);
    return c.json({ address, balance: balance.toString() });
  });

  router.get("/allowance/:owner/:spender", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const owner = c.req.param("owner") as `0x${string}`;
    const spender = c.req.param("spender") as `0x${string}`;
    const allowance = await sdk.usdc.allowance(owner, spender);
    return c.json({ owner, spender, allowance: allowance.toString() });
  });

  return router;
}
