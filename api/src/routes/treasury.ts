import { Hono } from "hono";
import type { AegisClient } from "@aegis-protocol/sdk";

export function createTreasuryRoutes(sdk?: AegisClient): Hono {
  const router = new Hono();

  router.get("/balance", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const balance = await sdk.treasury.totalBalance();
    return c.json({ balance: balance.toString() });
  });

  router.get("/balances", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const balances = await sdk.treasury.getBalances();
    return c.json({
      totalFeesCollected: balances.totalFeesCollected.toString(),
      treasuryBalance: balances.treasuryBalance.toString(),
      arbitratorPoolBalance: balances.arbitratorPoolBalance.toString(),
    });
  });

  return router;
}
