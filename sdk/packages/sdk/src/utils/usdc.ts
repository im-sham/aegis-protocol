import { AegisValidationError } from "@aegis-protocol/types";

/** USDC uses 6 decimal places. */
const USDC_DECIMALS = 6;
const USDC_FACTOR = 10n ** BigInt(USDC_DECIMALS); // 1_000_000n

/**
 * Parse a human-readable USDC string into its on-chain bigint representation
 * (6 decimals).
 *
 * @example
 *   parseUSDC("10.50")   // => 10_500_000n
 *   parseUSDC("0.01")    // => 10_000n
 *   parseUSDC("1000")    // => 1_000_000_000n
 *   parseUSDC("0.000001") // => 1n
 *
 * @throws {AegisValidationError} on negative values or more than 6 decimals.
 */
export function parseUSDC(amount: string): bigint {
  const trimmed = amount.trim();

  if (trimmed.startsWith("-")) {
    throw new AegisValidationError(
      `USDC amount cannot be negative: "${amount}"`
    );
  }

  const parts = trimmed.split(".");

  if (parts.length > 2) {
    throw new AegisValidationError(
      `Invalid USDC amount format: "${amount}"`
    );
  }

  const wholePart = parts[0] ?? "0";
  const decimalPart = parts[1] ?? "";

  if (decimalPart.length > USDC_DECIMALS) {
    throw new AegisValidationError(
      `USDC amount has more than ${USDC_DECIMALS} decimal places: "${amount}"`
    );
  }

  // Pad the decimal part to exactly 6 digits
  const paddedDecimals = decimalPart.padEnd(USDC_DECIMALS, "0");

  const wholeValue = BigInt(wholePart) * USDC_FACTOR;
  const decimalValue = BigInt(paddedDecimals);

  return wholeValue + decimalValue;
}

/**
 * Format an on-chain USDC bigint (6 decimals) into a human-readable string.
 *
 * Always shows at least 2 decimal places. Trims trailing zeros beyond that.
 *
 * @example
 *   formatUSDC(10_000_000n) // => "10.00"
 *   formatUSDC(10_000n)     // => "0.01"
 *   formatUSDC(1n)          // => "0.000001"
 *   formatUSDC(250_000n)    // => "0.25"
 *   formatUSDC(0n)          // => "0.00"
 */
export function formatUSDC(amount: bigint): string {
  const isNegative = amount < 0n;
  const abs = isNegative ? -amount : amount;

  const wholePart = abs / USDC_FACTOR;
  const decimalPart = abs % USDC_FACTOR;

  // Pad to exactly 6 digits
  const decimalStr = decimalPart.toString().padStart(USDC_DECIMALS, "0");

  // Trim trailing zeros, but keep at least 2 decimal places
  let trimmed = decimalStr.replace(/0+$/, "");
  if (trimmed.length < 2) {
    trimmed = decimalStr.slice(0, 2);
  }

  const sign = isNegative ? "-" : "";
  return `${sign}${wholePart}.${trimmed}`;
}
