import { Hono } from "hono";
import type { ContractAddresses, SupportedChain } from "@aegis-protocol/types";
import { getActiveConnections } from "./events.js";

export function createMetaRoutes(
  chain: SupportedChain,
  subgraphUrl: string,
  addresses: ContractAddresses,
): Hono {
  const router = new Hono();

  router.get("/health", (c) =>
    c.json({
      status: "ok",
      timestamp: Date.now(),
      activeStreams: getActiveConnections(),
    }),
  );

  router.get("/info", (c) =>
    c.json({
      version: "0.1.0",
      chain,
      subgraphUrl,
      contracts: {
        escrow: addresses.escrow,
        dispute: addresses.dispute,
        treasury: addresses.treasury,
        factory: addresses.factory,
      },
    }),
  );

  return router;
}
