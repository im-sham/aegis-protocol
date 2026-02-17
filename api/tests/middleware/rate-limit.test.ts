import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { rateLimiter } from "../../src/middleware/rate-limit.js";

describe("rate limiter", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.use("*", rateLimiter({ windowMs: 1000, max: 3 }));
    app.get("/test", (c) => c.json({ ok: true }));
  });

  it("allows requests within the limit", async () => {
    const res = await app.request("/test");
    expect(res.status).toBe(200);
  });

  it("returns 429 after exceeding the limit", async () => {
    for (let i = 0; i < 3; i++) {
      await app.request("/test");
    }
    const res = await app.request("/test");
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain("rate limit");
  });
});
