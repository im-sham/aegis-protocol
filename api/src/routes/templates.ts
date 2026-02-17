import { Hono } from "hono";
import type { AegisClient } from "@aegis-protocol/sdk";
import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { TEMPLATE_FIELDS } from "../services/subgraph.js";

export function createTemplateRoutes(sdk?: AegisClient, subgraph?: GraphQLClient): Hono {
  const router = new Hono();

  router.get("/:id", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const templateId = BigInt(c.req.param("id"));
    const template = await sdk.factory.getTemplate(templateId);
    const serialized = JSON.parse(
      JSON.stringify(template, (_: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v)),
    );
    return c.json(serialized);
  });

  router.get("/:id/active", async (c) => {
    if (!sdk) return c.json({ error: "SDK not initialized" }, 503);
    const templateId = BigInt(c.req.param("id"));
    const active = await sdk.factory.isTemplateActive(templateId);
    return c.json({ templateId: templateId.toString(), active });
  });

  router.get("/", async (c) => {
    if (!subgraph) return c.json({ error: "Subgraph not initialized" }, 503);
    const active = c.req.query("active");
    const first = parseInt(c.req.query("first") ?? "20", 10);
    const where = active === "true" ? `where: { active: true }` : "";
    const query = gql`
      query Templates {
        jobTemplates(first: ${first}, orderBy: createdAt, orderDirection: desc, ${where}) {
          ${TEMPLATE_FIELDS}
        }
      }
    `;
    const data = await subgraph.request(query);
    return c.json(data);
  });

  return router;
}
