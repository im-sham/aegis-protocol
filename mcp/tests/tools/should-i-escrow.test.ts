import { describe, it, expect } from "vitest";
import { handleShouldIEscrow } from "../../src/tools/should-i-escrow.js";

describe("handleShouldIEscrow", () => {
  it("strongly recommends escrow for high-value, low-trust transactions", async () => {
    const result = await handleShouldIEscrow({
      transactionValueUsd: 75,
      providerReputationScore: 45,
      jobType: "code-review",
      previousInteractions: 0,
      requiresObjectiveValidation: true,
    });

    expect(result.recommendation).toBe("STRONGLY_RECOMMENDED");
    expect(result.riskScore).toBeGreaterThanOrEqual(70);
    expect(result.suggestedAction).toContain("aegis_create_job");
    expect(result.recommendedTools).toContain("aegis_check_balance");
    expect(result.recommendedTools).toContain("aegis_create_job");
  });

  it("marks escrow as optional or unnecessary for low-value, high-trust transactions", async () => {
    const result = await handleShouldIEscrow({
      transactionValueUsd: 3,
      providerReputationScore: 92,
      jobType: "simple transfer",
      previousInteractions: 8,
      requiresObjectiveValidation: false,
    });

    expect(["OPTIONAL", "NOT_NECESSARY"]).toContain(result.recommendation);
    expect(result.riskScore).toBeLessThan(45);
  });

  it("raises recommendation when reputation is unknown", async () => {
    const known = await handleShouldIEscrow({
      transactionValueUsd: 25,
      providerReputationScore: 85,
      jobType: "data-analysis",
      previousInteractions: 1,
    });
    const unknown = await handleShouldIEscrow({
      transactionValueUsd: 25,
      jobType: "data-analysis",
      previousInteractions: 1,
    });

    expect(unknown.riskScore).toBeGreaterThan(known.riskScore);
    expect(unknown.confidence).toBe("medium");
    expect(unknown.recommendedTools).toContain("aegis_lookup_agent");
  });
});
