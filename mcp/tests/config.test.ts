import { describe, it, expect } from "vitest";
import { CHAIN_CONFIGS } from "@aegis-protocol/types";
import { resolveRpcUrls } from "../src/config.js";

describe("resolveRpcUrls", () => {
  it("prioritizes AEGIS_RPC_URL and preserves fallback order", () => {
    const urls = resolveRpcUrls("base-sepolia", {
      AEGIS_RPC_URL: "https://primary.example.com",
      BASE_SEPOLIA_RPC_URL: "https://chain-specific.example.com",
    });

    expect(urls).toEqual([
      "https://primary.example.com",
      "https://chain-specific.example.com",
      CHAIN_CONFIGS["base-sepolia"].rpcUrl,
    ]);
  });

  it("parses and deduplicates AEGIS_RPC_URLS entries", () => {
    const urls = resolveRpcUrls("base", {
      AEGIS_RPC_URLS:
        " https://a.example.com, https://b.example.com, https://a.example.com, not-a-url ",
      BASE_RPC_URL: "https://base-chain.example.com",
    });

    expect(urls).toEqual([
      "https://a.example.com",
      "https://b.example.com",
      "https://base-chain.example.com",
      CHAIN_CONFIGS.base.rpcUrl,
    ]);
  });

  it("falls back to chain default when no custom env is set", () => {
    const urls = resolveRpcUrls("base-sepolia", {});
    expect(urls).toEqual([CHAIN_CONFIGS["base-sepolia"].rpcUrl]);
  });
});
