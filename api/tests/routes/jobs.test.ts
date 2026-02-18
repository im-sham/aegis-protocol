import { describe, it, expect } from "vitest";

describe("job routes", () => {
  it("createJobRoutes mounts without errors", async () => {
    const { createJobRoutes } = await import("../../src/routes/jobs.js");
    expect(() => createJobRoutes()).not.toThrow();
  });
});
