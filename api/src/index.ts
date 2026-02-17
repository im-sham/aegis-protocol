import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadConfig } from "./config.js";

const app = new Hono();

app.use("*", cors());

app.get("/health", (c) => c.json({ status: "ok", timestamp: Date.now() }));

app.get("/info", (c) => {
  const config = loadConfig();
  return c.json({
    version: "0.1.0",
    chain: config.chain,
    subgraphUrl: config.subgraphUrl,
  });
});

const config = loadConfig();

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`AEGIS API listening on http://localhost:${info.port}`);
});

export { app };
