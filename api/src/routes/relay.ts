import { Hono } from "hono";
import type { SupportedChain } from "@aegis-protocol/types";
import { RelayRequestSchema } from "../schemas/relay.js";
import {
  decodeRawTransaction,
  validateSignedTransaction,
  broadcastTransaction,
} from "../services/relay.js";

export function createRelayRoute(
  whitelist: Set<string>,
  chainId: number,
  rpcUrl: string,
  chain: SupportedChain,
): Hono {
  const router = new Hono();

  router.post("/relay", async (c) => {
    // Parse and validate request body
    const body = await c.req.json().catch(() => null);
    const parsed = RelayRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Invalid request", details: parsed.error.issues },
        400,
      );
    }

    const { signedTx } = parsed.data;

    // Decode the signed transaction
    let decoded;
    try {
      decoded = decodeRawTransaction(signedTx as `0x${string}`);
    } catch {
      return c.json({ error: "Failed to decode signed transaction" }, 400);
    }

    // Validate against whitelist and chain
    const validation = validateSignedTransaction(decoded, whitelist, chainId);
    if (!validation.valid) {
      return c.json({ error: validation.error }, 403);
    }

    // Broadcast
    const wait = c.req.query("wait") !== "false";
    try {
      const result = await broadcastTransaction(
        rpcUrl,
        chain,
        signedTx as `0x${string}`,
        wait,
      );

      if (result.receipt) {
        return c.json({
          txHash: result.txHash,
          blockNumber: Number(result.receipt.blockNumber),
          status: result.receipt.status === "success" ? "success" : "reverted",
        });
      }

      return c.json({ txHash: result.txHash, status: "pending" });
    } catch (err: any) {
      return c.json(
        { error: "Transaction broadcast failed", reason: err.shortMessage ?? err.message },
        502,
      );
    }
  });

  return router;
}
