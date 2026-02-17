import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadConfig } from "./config.js";
import { errorHandler } from "./middleware/error-handler.js";
import { rateLimiter } from "./middleware/rate-limit.js";
import { createSdkClient, getContractAddresses, getContractWhitelist } from "./services/sdk.js";
import { getSubgraphClient } from "./services/subgraph.js";
import { createJobRoutes } from "./routes/jobs.js";
import { createDisputeRoutes } from "./routes/disputes.js";
import { createTemplateRoutes } from "./routes/templates.js";
import { createAgentRoutes } from "./routes/agents.js";
import { createUsdcRoutes } from "./routes/usdc.js";
import { createTreasuryRoutes } from "./routes/treasury.js";
import { createRelayRoute } from "./routes/relay.js";
import { createEventRoutes } from "./routes/events.js";
import { createMetaRoutes } from "./routes/meta.js";
import { CHAIN_CONFIGS } from "@aegis-protocol/types";

const config = loadConfig();
const addresses = getContractAddresses(config.chain);
const whitelist = getContractWhitelist(config.chain);
const chainId = CHAIN_CONFIGS[config.chain].chainId;
const sdk = createSdkClient(config.chain, config.rpcUrl);
const subgraph = getSubgraphClient(config.subgraphUrl);

const app = new Hono();

// Global middleware
app.use("*", cors());
app.use("*", rateLimiter({ windowMs: 60_000, max: 120 }));
app.onError(errorHandler);

// Mount routes
app.route("/", createMetaRoutes(config.chain, config.subgraphUrl, addresses));
app.route("/jobs", createJobRoutes(sdk, subgraph));
app.route("/disputes", createDisputeRoutes(sdk, subgraph));
app.route("/templates", createTemplateRoutes(sdk, subgraph));
app.route("/agents", createAgentRoutes(sdk));
app.route("/usdc", createUsdcRoutes(sdk));
app.route("/treasury", createTreasuryRoutes(sdk));
app.route("/tx", createRelayRoute(whitelist, chainId, config.rpcUrl, config.chain));
app.route("/events", createEventRoutes(config.rpcUrl, config.chain, addresses));

// Only start the server if this file is run directly (not imported for testing)
if (process.env.NODE_ENV !== "test") {
  serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(`AEGIS API v0.1.0 | chain=${config.chain} | http://localhost:${info.port}`);
  });
}

export { app };
