import { describe, it, expect, vi } from "vitest";

describe("job routes", () => {
  it("createJobRoutes mounts without errors", async () => {
    const { createJobRoutes } = await import("../../src/routes/jobs.js");
    expect(() => createJobRoutes()).not.toThrow();
  });

  it("rejects invalid pagination values", async () => {
    const { createJobRoutes } = await import("../../src/routes/jobs.js");
    const subgraph = { request: vi.fn() } as any;
    const app = createJobRoutes(undefined, subgraph);

    const res = await app.request("/?first=1000");
    expect(res.status).toBe(400);
    expect(subgraph.request).not.toHaveBeenCalled();
  });

  it("uses GraphQL variables for list queries", async () => {
    const { createJobRoutes } = await import("../../src/routes/jobs.js");
    const subgraph = { request: vi.fn().mockResolvedValue({ jobs: [] }) } as any;
    const app = createJobRoutes(undefined, subgraph);

    const res = await app.request("/?first=10&skip=5&state=FUNDED");
    expect(res.status).toBe(200);
    expect(subgraph.request).toHaveBeenCalledTimes(1);
    expect(subgraph.request.mock.calls[0][1]).toEqual({ first: 10, skip: 5, state: "FUNDED" });
  });
});
