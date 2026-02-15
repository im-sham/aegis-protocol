import { describe, it, expect } from "vitest";
import { parseUSDC, formatUSDC } from "../utils/usdc";

describe("parseUSDC", () => {
  it('should parse "10.00" to 10_000_000n', () => {
    expect(parseUSDC("10.00")).toBe(10_000_000n);
  });

  it('should parse "0.01" to 10_000n', () => {
    expect(parseUSDC("0.01")).toBe(10_000n);
  });

  it('should parse "1000" to 1_000_000_000n', () => {
    expect(parseUSDC("1000")).toBe(1_000_000_000n);
  });

  it('should parse "0.000001" to 1n', () => {
    expect(parseUSDC("0.000001")).toBe(1n);
  });

  it('should parse "10.50" to 10_500_000n', () => {
    expect(parseUSDC("10.50")).toBe(10_500_000n);
  });

  it('should parse "0" to 0n', () => {
    expect(parseUSDC("0")).toBe(0n);
  });

  it("should throw on negative amounts", () => {
    expect(() => parseUSDC("-5.00")).toThrow("negative");
  });

  it("should throw on more than 6 decimal places", () => {
    expect(() => parseUSDC("1.0000001")).toThrow("6 decimal");
  });
});

describe("formatUSDC", () => {
  it('should format 10_000_000n to "10.00"', () => {
    expect(formatUSDC(10_000_000n)).toBe("10.00");
  });

  it('should format 10_000n to "0.01"', () => {
    expect(formatUSDC(10_000n)).toBe("0.01");
  });

  it('should format 1n to "0.000001"', () => {
    expect(formatUSDC(1n)).toBe("0.000001");
  });

  it('should format 250_000n to "0.25"', () => {
    expect(formatUSDC(250_000n)).toBe("0.25");
  });

  it('should format 0n to "0.00"', () => {
    expect(formatUSDC(0n)).toBe("0.00");
  });

  it('should format 1_000_000_000n to "1000.00"', () => {
    expect(formatUSDC(1_000_000_000n)).toBe("1000.00");
  });

  it('should format 10_500_000n to "10.50"', () => {
    expect(formatUSDC(10_500_000n)).toBe("10.50");
  });

  it('should format 123_456n to "0.123456"', () => {
    expect(formatUSDC(123_456n)).toBe("0.123456");
  });
});
