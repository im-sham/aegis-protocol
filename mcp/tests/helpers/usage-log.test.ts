import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it, expect } from "vitest";
import { createUsageLogger } from "../../src/helpers/usage-log.js";

describe("createUsageLogger", () => {
  it("is disabled when no log path is configured", async () => {
    const logger = createUsageLogger({
      chain: "base-sepolia",
      mode: "read-only",
      context: "local",
      sessionId: "session-1",
    });

    expect(logger.enabled).toBe(false);
    await expect(
      logger.logToolCall({
        toolName: "aegis_should_i_escrow",
        category: "advisory",
        success: true,
        durationMs: 12,
      }),
    ).resolves.toBeUndefined();
  });

  it("writes JSONL records with context metadata", async () => {
    const dir = await mkdtemp(join(tmpdir(), "aegis-usage-log-"));
    const logPath = join(dir, "usage.jsonl");
    const logger = createUsageLogger({
      logPath,
      chain: "base-sepolia",
      mode: "signing",
      context: "external",
      actor: "partner-agent",
      source: "crewai",
      sessionId: "session-2",
    });

    await logger.logToolCall({
      toolName: "aegis_create_job",
      category: "write",
      success: false,
      durationMs: 34,
      error: "Insufficient allowance\nfull stack omitted",
    });

    const contents = await readFile(logPath, "utf8");
    const [line] = contents.trim().split("\n");
    const record = JSON.parse(line);

    expect(record.sessionId).toBe("session-2");
    expect(record.context).toBe("external");
    expect(record.actor).toBe("partner-agent");
    expect(record.source).toBe("crewai");
    expect(record.toolName).toBe("aegis_create_job");
    expect(record.category).toBe("write");
    expect(record.success).toBe(false);
    expect(record.error).toBe("Insufficient allowance");
  });
});
