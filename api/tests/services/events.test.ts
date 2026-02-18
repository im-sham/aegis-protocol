import { describe, it, expect, vi } from "vitest";

// Mock workspace packages that don't resolve in isolation
vi.mock("@aegis-protocol/abis", () => ({
  AegisEscrowAbi: [],
  AegisDisputeAbi: [],
  AegisTreasuryAbi: [],
  AegisJobFactoryAbi: [],
}));
vi.mock("@aegis-protocol/types", () => ({
  CHAIN_CONFIGS: {},
}));

import { parseStreamFilters } from "../../src/services/events.js";

describe("event stream filters", () => {
  it("parses empty query to no filters", () => {
    const filters = parseStreamFilters({});
    expect(filters.jobId).toBeUndefined();
    expect(filters.contract).toBeUndefined();
    expect(filters.eventType).toBeUndefined();
  });

  it("parses job filter", () => {
    const filters = parseStreamFilters({ job: "0xabc123" });
    expect(filters.jobId).toBe("0xabc123");
  });

  it("parses contract filter", () => {
    const filters = parseStreamFilters({ contract: "escrow" });
    expect(filters.contract).toBe("escrow");
  });

  it("parses event type filter", () => {
    const filters = parseStreamFilters({ type: "JobSettled" });
    expect(filters.eventType).toBe("JobSettled");
  });

  it("parses combined filters", () => {
    const filters = parseStreamFilters({ job: "0x1", contract: "dispute", type: "DisputeResolved" });
    expect(filters.jobId).toBe("0x1");
    expect(filters.contract).toBe("dispute");
    expect(filters.eventType).toBe("DisputeResolved");
  });
});
