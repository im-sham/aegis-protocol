import { describe, it, expect, vi } from "vitest";

// Mock workspace packages that don't resolve in isolation
vi.mock("@aegis-protocol/sdk", () => ({
  AegisClient: {
    readOnly: () => ({
      escrow: {},
      dispute: {},
      treasury: {},
      factory: {},
      identity: {},
      reputation: {},
      validation: {},
      usdc: {},
    }),
  },
}));
vi.mock("@aegis-protocol/types", () => ({
  CHAIN_CONFIGS: {
    "base-sepolia": {
      chainId: 84532,
      contracts: {
        escrow: "0xe988128467299fD856Bb45D2241811837BF35E77",
        dispute: "0x2c831D663B87194Fa6444df17A9A7d135186Cb41",
        treasury: "0xE64D271a863aa1438FBb36Bd1F280FA1F499c3f5",
        factory: "0xFD451BEfa1eE3EB4dBCA4E9EA539B4bf432866dA",
      },
    },
  },
}));
vi.mock("@aegis-protocol/abis", () => ({
  AegisEscrowAbi: [],
  AegisDisputeAbi: [],
  AegisTreasuryAbi: [],
  AegisJobFactoryAbi: [],
}));

// Mock env vars before importing app
vi.stubEnv("RPC_URL", "https://sepolia.base.org");
vi.stubEnv("SUBGRAPH_URL", "https://api.studio.thegraph.com/query/test/aegis/v0.1.0");
vi.stubEnv("CHAIN", "base-sepolia");
vi.stubEnv("NODE_ENV", "test");

describe("app integration", () => {
  it("GET /health returns 200", async () => {
    const { app } = await import("../src/index.js");
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  it("GET /info returns chain and version", async () => {
    const { app } = await import("../src/index.js");
    const res = await app.request("/info");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.version).toBe("0.1.0");
    expect(body.chain).toBe("base-sepolia");
  });

  it("POST /tx/relay with empty body returns 400", async () => {
    const { app } = await import("../src/index.js");
    const res = await app.request("/tx/relay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("GET /nonexistent returns 404", async () => {
    const { app } = await import("../src/index.js");
    const res = await app.request("/nonexistent");
    expect(res.status).toBe(404);
  });
});
