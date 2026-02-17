import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { SupportedChain, ContractAddresses } from "@aegis-protocol/types";
import { parseStreamFilters, watchAllContracts, matchesFilters } from "../services/events.js";

// Track active SSE connections for the /health endpoint
let activeConnections = 0;
export function getActiveConnections(): number {
  return activeConnections;
}

export function createEventRoutes(
  rpcUrl: string,
  chain: SupportedChain,
  addresses: ContractAddresses,
): Hono {
  const router = new Hono();

  router.get("/stream", (c) => {
    const filters = parseStreamFilters({
      job: c.req.query("job"),
      contract: c.req.query("contract"),
      type: c.req.query("type"),
    });

    return streamSSE(c, async (stream) => {
      activeConnections++;

      // Send initial keepalive
      await stream.writeSSE({ data: JSON.stringify({ type: "connected", filters }), event: "system" });

      const unwatch = watchAllContracts(rpcUrl, chain, addresses, (contractName, eventName, log) => {
        if (matchesFilters(contractName, eventName, log, filters)) {
          stream
            .writeSSE({
              data: JSON.stringify({
                contract: contractName,
                event: eventName,
                blockNumber: log.blockNumber?.toString(),
                transactionHash: log.transactionHash,
                args: (log as any).args,
              }),
              event: eventName,
            })
            .catch(() => {});
        }
      });

      // Keepalive every 30s
      const keepalive = setInterval(() => {
        stream.writeSSE({ data: "", event: "ping" }).catch(() => {});
      }, 30_000);

      // Cleanup on disconnect
      stream.onAbort(() => {
        activeConnections--;
        clearInterval(keepalive);
        unwatch();
      });

      // Hold the stream open indefinitely
      await new Promise(() => {});
    });
  });

  return router;
}
