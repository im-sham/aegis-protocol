import type { MiddlewareHandler } from "hono";

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export function rateLimiter(options: RateLimitOptions): MiddlewareHandler {
  const store = new Map<string, RateLimitEntry>();

  // Periodic cleanup every 60s
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) store.delete(key);
    }
  }, 60_000).unref();

  return async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("cf-connecting-ip") ??
      "unknown";

    const now = Date.now();
    let entry = store.get(ip);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + options.windowMs };
      store.set(ip, entry);
    }

    entry.count++;

    c.header("X-RateLimit-Limit", String(options.max));
    c.header("X-RateLimit-Remaining", String(Math.max(0, options.max - entry.count)));
    c.header("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > options.max) {
      return c.json(
        { error: "Too many requests — rate limit exceeded", retryAfter: Math.ceil((entry.resetAt - now) / 1000) },
        429,
      );
    }

    await next();
  };
}
