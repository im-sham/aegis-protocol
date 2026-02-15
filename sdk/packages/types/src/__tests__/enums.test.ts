import { describe, it, expect } from "vitest";
import { JobState, DisputeResolution } from "../enums";

describe("JobState", () => {
  it("should have exactly 11 values", () => {
    // Numeric enums in TS generate forward + reverse mappings,
    // so the number of unique numeric values is half the total keys.
    const numericValues = Object.values(JobState).filter(
      (v) => typeof v === "number"
    );
    expect(numericValues).toHaveLength(11);
  });

  it("should map CREATED to 0", () => {
    expect(JobState.CREATED).toBe(0);
  });

  it("should map CANCELLED to 10", () => {
    expect(JobState.CANCELLED).toBe(10);
  });

  it("should map all intermediate states correctly", () => {
    expect(JobState.FUNDED).toBe(1);
    expect(JobState.DELIVERED).toBe(2);
    expect(JobState.VALIDATING).toBe(3);
    expect(JobState.DISPUTE_WINDOW).toBe(4);
    expect(JobState.SETTLED).toBe(5);
    expect(JobState.DISPUTED).toBe(6);
    expect(JobState.RESOLVED).toBe(7);
    expect(JobState.EXPIRED).toBe(8);
    expect(JobState.REFUNDED).toBe(9);
  });
});

describe("DisputeResolution", () => {
  it("should have exactly 5 values", () => {
    const numericValues = Object.values(DisputeResolution).filter(
      (v) => typeof v === "number"
    );
    expect(numericValues).toHaveLength(5);
  });

  it("should map NONE to 0", () => {
    expect(DisputeResolution.NONE).toBe(0);
  });

  it("should map CLIENT_CONFIRM to 4", () => {
    expect(DisputeResolution.CLIENT_CONFIRM).toBe(4);
  });

  it("should map all intermediate values correctly", () => {
    expect(DisputeResolution.RE_VALIDATION).toBe(1);
    expect(DisputeResolution.ARBITRATOR).toBe(2);
    expect(DisputeResolution.TIMEOUT_DEFAULT).toBe(3);
  });
});
