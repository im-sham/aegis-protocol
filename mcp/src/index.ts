import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import { createSdkClient, isSigningClient } from "./sdk-client.js";

// Read tools
import { checkJobDef, handleCheckJob } from "./tools/check-job.js";
import { lookupAgentDef, handleLookupAgent } from "./tools/lookup-agent.js";
import { listJobsDef, handleListJobs } from "./tools/list-jobs.js";
import { checkBalanceDef, handleCheckBalance } from "./tools/check-balance.js";
import { getTemplateDef, handleGetTemplate } from "./tools/get-template.js";

// Write tools
import { createJobDef, handleCreateJob } from "./tools/create-job.js";
import { deliverWorkDef, handleDeliverWork } from "./tools/deliver-work.js";
import { settleJobDef, handleSettleJob } from "./tools/settle-job.js";
import { openDisputeDef, handleOpenDispute } from "./tools/open-dispute.js";
import { claimRefundDef, handleClaimRefund } from "./tools/claim-refund.js";

// ---------------------------------------------------------------------------
// Helper: wrap tool handlers with error handling and JSON serialization
// ---------------------------------------------------------------------------

function toolResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// Server factory — used by both stdio entry point and Smithery sandbox
// ---------------------------------------------------------------------------

type Config = ReturnType<typeof loadConfig>;

function createServer(cfg?: Config) {
  const config = cfg ?? loadConfig();
  const client = createSdkClient(config);
  const signing = isSigningClient(config);

  const server = new McpServer({
    name: "aegis-protocol",
    version: "0.1.2",
  });

  // --- Read tools ---

  server.registerTool(checkJobDef.name, {
    description: checkJobDef.description,
    inputSchema: checkJobDef.inputSchema,
  }, async (args) => {
    try {
      return toolResult(await handleCheckJob(client, args));
    } catch (e) {
      return toolError(e);
    }
  });

  server.registerTool(lookupAgentDef.name, {
    description: lookupAgentDef.description,
    inputSchema: lookupAgentDef.inputSchema,
  }, async (args) => {
    try {
      return toolResult(await handleLookupAgent(client, args));
    } catch (e) {
      return toolError(e);
    }
  });

  server.registerTool(listJobsDef.name, {
    description: listJobsDef.description,
    inputSchema: listJobsDef.inputSchema,
  }, async (args) => {
    try {
      return toolResult(await handleListJobs(client, args));
    } catch (e) {
      return toolError(e);
    }
  });

  server.registerTool(checkBalanceDef.name, {
    description: checkBalanceDef.description,
    inputSchema: checkBalanceDef.inputSchema,
  }, async (args) => {
    try {
      return toolResult(await handleCheckBalance(client, config, args));
    } catch (e) {
      return toolError(e);
    }
  });

  server.registerTool(getTemplateDef.name, {
    description: getTemplateDef.description,
    inputSchema: getTemplateDef.inputSchema,
  }, async (args) => {
    try {
      return toolResult(await handleGetTemplate(client, args));
    } catch (e) {
      return toolError(e);
    }
  });

  // --- Write tools ---

  server.registerTool(createJobDef.name, {
    description: createJobDef.description,
    inputSchema: createJobDef.inputSchema,
    annotations: {
      title: "Create Escrow Job",
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  }, async (args) => {
    try {
      return toolResult(await handleCreateJob(client, config, args));
    } catch (e) {
      return toolError(e);
    }
  });

  server.registerTool(deliverWorkDef.name, {
    description: deliverWorkDef.description,
    inputSchema: deliverWorkDef.inputSchema,
    annotations: {
      title: "Deliver Work",
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  }, async (args) => {
    try {
      return toolResult(await handleDeliverWork(client, config, args));
    } catch (e) {
      return toolError(e);
    }
  });

  server.registerTool(settleJobDef.name, {
    description: settleJobDef.description,
    inputSchema: settleJobDef.inputSchema,
    annotations: {
      title: "Settle Job",
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  }, async (args) => {
    try {
      return toolResult(await handleSettleJob(client, config, args));
    } catch (e) {
      return toolError(e);
    }
  });

  server.registerTool(openDisputeDef.name, {
    description: openDisputeDef.description,
    inputSchema: openDisputeDef.inputSchema,
    annotations: {
      title: "Open Dispute",
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  }, async (args) => {
    try {
      return toolResult(await handleOpenDispute(client, config, args));
    } catch (e) {
      return toolError(e);
    }
  });

  server.registerTool(claimRefundDef.name, {
    description: claimRefundDef.description,
    inputSchema: claimRefundDef.inputSchema,
    annotations: {
      title: "Claim Refund",
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  }, async (args) => {
    try {
      return toolResult(await handleClaimRefund(client, config, args));
    } catch (e) {
      return toolError(e);
    }
  });

  return { server, config, client, signing };
}

// ---------------------------------------------------------------------------
// Smithery sandbox export — allows Smithery to scan tools without credentials
// ---------------------------------------------------------------------------

export function createSandboxServer() {
  const sandboxConfig = {
    chain: "base-sepolia" as const,
    rpcUrl: "https://sepolia.base.org",
    privateKey: undefined,
    apiUrl: undefined,
  };
  const { server: sandboxServer } = createServer(sandboxConfig);
  return sandboxServer;
}

// ---------------------------------------------------------------------------
// Connect transport and start (only when run directly, not when imported)
// ---------------------------------------------------------------------------

async function main() {
  const { server, config, signing } = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const mode = signing ? "signing" : "read-only";
  console.error(`AEGIS MCP Server running (${mode} mode, chain: ${config.chain})`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
