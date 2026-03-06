import { randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { SupportedChain } from "@aegis-protocol/types";
import type { UsageContext } from "../config.js";

export type ToolCategory = "read" | "advisory" | "write";
export type ToolMode = "read-only" | "signing";

interface UsageLoggerOptions {
  logPath?: string;
  context: UsageContext;
  actor?: string;
  source?: string;
  chain: SupportedChain;
  mode: ToolMode;
  sessionId?: string;
}

interface LogToolCallArgs {
  toolName: string;
  category: ToolCategory;
  success: boolean;
  durationMs: number;
  error?: string;
}

export interface ToolUsageRecord {
  timestamp: string;
  sessionId: string;
  chain: SupportedChain;
  mode: ToolMode;
  context: UsageContext;
  actor?: string;
  source?: string;
  toolName: string;
  category: ToolCategory;
  success: boolean;
  durationMs: number;
  error?: string;
}

export interface UsageLogger {
  enabled: boolean;
  sessionId: string;
  logToolCall(args: LogToolCallArgs): Promise<void>;
}

function sanitizeError(error: string | undefined): string | undefined {
  if (!error) return undefined;
  const firstLine = error.trim().split("\n")[0] ?? "";
  return firstLine.slice(0, 500);
}

export function createUsageLogger(options: UsageLoggerOptions): UsageLogger {
  const sessionId = options.sessionId ?? randomUUID();

  if (!options.logPath) {
    return {
      enabled: false,
      sessionId,
      async logToolCall() {
        return;
      },
    };
  }

  const logPath = options.logPath;

  return {
    enabled: true,
    sessionId,
    async logToolCall(args: LogToolCallArgs) {
      const record: ToolUsageRecord = {
        timestamp: new Date().toISOString(),
        sessionId,
        chain: options.chain,
        mode: options.mode,
        context: options.context,
        actor: options.actor,
        source: options.source,
        toolName: args.toolName,
        category: args.category,
        success: args.success,
        durationMs: args.durationMs,
        error: sanitizeError(args.error),
      };

      try {
        await mkdir(dirname(logPath), { recursive: true });
        await appendFile(logPath, `${JSON.stringify(record)}\n`, "utf8");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`AEGIS usage log write failed: ${message}`);
      }
    },
  };
}
