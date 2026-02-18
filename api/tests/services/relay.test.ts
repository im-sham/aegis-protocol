import { describe, it, expect } from "vitest";
import { validateSignedTransaction } from "../../src/services/relay.js";

const WHITELIST = new Set([
  "0xe988128467299fd856bb45d2241811837bf35e77",
  "0x2c831d663b87194fa6444df17a9a7d135186cb41",
  "0xe64d271a863aa1438fbb36bd1f280fa1f499c3f5",
  "0xfd451befa1ee3eb4dbca4e9ea539b4bf432866da",
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
        to: "0xe988128467299fD856Bb45D2241811837BF35E77",
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
        to: "0xe988128467299fD856Bb45D2241811837BF35E77",
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
        to: "0xE988128467299FD856BB45D2241811837BF35E77",
        chainId: 84532,
      },
      WHITELIST,
      84532,
    );
    expect(result.valid).toBe(true);
  });
});
