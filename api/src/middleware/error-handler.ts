import type { ErrorHandler } from "hono";

export const errorHandler: ErrorHandler = (err, c) => {
  const status = (err as any).status ?? 500;

  if (status >= 500) {
    console.error("[AEGIS API Error]", err);
    return c.json({ error: "Internal server error" }, 500);
  }

  return c.json({ error: err.message }, status);
};
