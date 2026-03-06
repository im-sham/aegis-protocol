import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig } from "./config.js";
import {
  createUsageLogger,
  type ToolCategory,
} from "./helpers/usage-log.js";
import { createSdkClient, isSigningClient } from "./sdk-client.js";

// Read tools
import { checkJobDef, handleCheckJob } from "./tools/check-job.js";
import { lookupAgentDef, handleLookupAgent } from "./tools/lookup-agent.js";
import { listJobsDef, handleListJobs } from "./tools/list-jobs.js";
import { checkBalanceDef, handleCheckBalance } from "./tools/check-balance.js";
import { getTemplateDef, handleGetTemplate } from "./tools/get-template.js";
import { shouldIEscrowDef, handleShouldIEscrow } from "./tools/should-i-escrow.js";

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

interface ToolAnnotations {
  title: string;
  readOnlyHint: boolean;
  destructiveHint: boolean;
  openWorldHint: boolean;
}

interface ToolRegistration {
  def: {
    name: string;
    description: string;
    inputSchema: Record<string, z.ZodTypeAny>;
  };
  category: ToolCategory;
  annotations?: ToolAnnotations;
  handler(args: any): Promise<unknown>;
}

function registerToolWithTelemetry(
  server: McpServer,
  registration: ToolRegistration,
  usageLogger: ReturnType<typeof createUsageLogger>,
) {
  const { def, category, annotations, handler } = registration;

  server.registerTool(
    def.name,
    {
      description: def.description,
      inputSchema: def.inputSchema,
      ...(annotations ? { annotations } : {}),
    },
    async (args) => {
      const startedAt = Date.now();
      try {
        const result = await handler(args);
        await usageLogger.logToolCall({
          toolName: def.name,
          category,
          success: true,
          durationMs: Date.now() - startedAt,
        });
        return toolResult(result);
      } catch (error) {
        await usageLogger.logToolCall({
          toolName: def.name,
          category,
          success: false,
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        });
        return toolError(error);
      }
    },
  );
}

function createServer(cfg?: Config) {
  const config = cfg ?? loadConfig();
  const client = createSdkClient(config);
  const signing = isSigningClient(config);
  const mode = signing ? "signing" : "read-only";
  const usageLogger = createUsageLogger({
    logPath: config.usageLogPath,
    context: config.usageContext ?? "local",
    actor: config.usageActor,
    source: config.usageSource,
    chain: config.chain,
    mode,
  });

  const server = new McpServer({
    name: "aegis-protocol",
    version: "0.1.2",
  });

  // --- Read tools ---

  registerToolWithTelemetry(server, {
    def: checkJobDef,
    category: "read",
    handler: async (args) => handleCheckJob(client, args),
  }, usageLogger);

  registerToolWithTelemetry(server, {
    def: lookupAgentDef,
    category: "read",
    handler: async (args) => handleLookupAgent(client, args),
  }, usageLogger);

  registerToolWithTelemetry(server, {
    def: listJobsDef,
    category: "read",
    handler: async (args) => handleListJobs(client, args),
  }, usageLogger);

  registerToolWithTelemetry(server, {
    def: checkBalanceDef,
    category: "read",
    handler: async (args) => handleCheckBalance(client, config, args),
  }, usageLogger);

  registerToolWithTelemetry(server, {
    def: getTemplateDef,
    category: "read",
    handler: async (args) => handleGetTemplate(client, args),
  }, usageLogger);

  registerToolWithTelemetry(server, {
    def: shouldIEscrowDef,
    category: "advisory",
    handler: async (args) => handleShouldIEscrow(args),
  }, usageLogger);

  // --- Write tools ---

  registerToolWithTelemetry(server, {
    def: createJobDef,
    category: "write",
    annotations: {
      title: "Create Escrow Job",
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
    handler: async (args) => handleCreateJob(client, config, args),
  }, usageLogger);

  registerToolWithTelemetry(server, {
    def: deliverWorkDef,
    category: "write",
    annotations: {
      title: "Deliver Work",
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
    handler: async (args) => handleDeliverWork(client, config, args),
  }, usageLogger);

  registerToolWithTelemetry(server, {
    def: settleJobDef,
    category: "write",
    annotations: {
      title: "Settle Job",
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
    handler: async (args) => handleSettleJob(client, config, args),
  }, usageLogger);

  registerToolWithTelemetry(server, {
    def: openDisputeDef,
    category: "write",
    annotations: {
      title: "Open Dispute",
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
    handler: async (args) => handleOpenDispute(client, config, args),
  }, usageLogger);

  registerToolWithTelemetry(server, {
    def: claimRefundDef,
    category: "write",
    annotations: {
      title: "Claim Refund",
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
    handler: async (args) => handleClaimRefund(client, config, args),
  }, usageLogger);

  return { server, config, client, signing, usageLogger };
}

// ---------------------------------------------------------------------------
// Smithery sandbox export — allows Smithery to scan tools without credentials
// ---------------------------------------------------------------------------

export function createSandboxServer() {
  const rpcUrl = "https://sepolia.base.org";
  const sandboxConfig = {
    chain: "base-sepolia" as const,
    rpcUrl,
    rpcUrls: [rpcUrl],
    privateKey: undefined,
    apiUrl: undefined,
    usageContext: "local" as const,
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
