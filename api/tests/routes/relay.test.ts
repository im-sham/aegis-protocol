import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { createRelayRoute } from "../../src/routes/relay.js";

const WHITELIST = new Set([
  "0xe988128467299fd856bb45d2241811837bf35e77",
]);

describe("relay route", () => {
  it("rejects invalid hex body", async () => {
    const app = new Hono();
    app.route("/tx", createRelayRoute(WHITELIST, 84532, "https://sepolia.base.org", "base-sepolia"));

    const res = await app.request("/tx/relay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedTx: "not-hex" }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects missing signedTx field", async () => {
    const app = new Hono();
    app.route("/tx", createRelayRoute(WHITELIST, 84532, "https://sepolia.base.org", "base-sepolia"));

    const res = await app.request("/tx/relay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
