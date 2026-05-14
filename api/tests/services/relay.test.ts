import { describe, it, expect } from "vitest";
import { validateSignedTransaction } from "../../src/services/relay.js";

const WHITELIST = new Set([
  "0x8e013cf23f11168b62ba2600d99166507cbb4aac",
  "0x9cbe0bf5080568f56d61f4f3ef0f64909898dcb2",
  "0xcd2a996edd6be2992063fd2a41c0240d77c9e0aa",
  "0xd6a9fafa4d1d233075d6c5de2a407942bdc29dbf",
]);

describe("relay service", () => {
  it("rejects tx with non-whitelisted to address", () => {
    const result = validateSignedTransaction(
      {
        to: "0x0000000000000000000000000000000000000001",
        chainId: 84532,
      },
      WHITELIST,
      84532,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not an AEGIS contract");
  });

  it("rejects tx with wrong chain ID", () => {
    const result = validateSignedTransaction(
      {
        to: "0x8e013cf23f11168B62bA2600d99166507Cbb4aAC",
        chainId: 1,
      },
      WHITELIST,
      84532,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("chain ID");
  });

  it("rejects tx with no to address (contract creation)", () => {
    const result = validateSignedTransaction(
      {
        to: null,
        chainId: 84532,
      },
      WHITELIST,
      84532,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Contract creation");
  });

  it("accepts valid tx to whitelisted contract", () => {
    const result = validateSignedTransaction(
      {
        to: "0x8e013cf23f11168B62bA2600d99166507Cbb4aAC",
        chainId: 84532,
      },
      WHITELIST,
      84532,
    );
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("accepts valid tx case-insensitive", () => {
    const result = validateSignedTransaction(
      {
        to: "0x8E013CF23F11168B62BA2600D99166507CBB4AAC",
        chainId: 84532,
      },
      WHITELIST,
      84532,
    );
    expect(result.valid).toBe(true);
  });
});
