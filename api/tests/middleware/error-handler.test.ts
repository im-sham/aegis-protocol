import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { errorHandler } from "../../src/middleware/error-handler.js";

describe("error handler", () => {
  it("catches thrown errors and returns sanitized JSON", async () => {
    const app = new Hono();
    app.onError(errorHandler);
    app.get("/fail", () => {
      throw new Error("internal secret details");
    });

    const res = await app.request("/fail");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
    expect(body.message).toBeUndefined();
  });

  it("returns 400 for validation errors", async () => {
    const app = new Hono();
    app.onError(errorHandler);
    app.get("/fail", () => {
      const err = new Error("bad input") as any;
      err.status = 400;
      throw err;
    });

    const res = await app.request("/fail");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("bad input");
  });
});
