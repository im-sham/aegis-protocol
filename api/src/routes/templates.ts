import { Hono } from "hono";
import type { AegisClient } from "@aegis-protocol/sdk";
import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import { TEMPLATE_FIELDS } from "../services/subgraph.js";

export function createTemplateRoutes(sdk?: AegisClient, subgraph?: GraphQLClient): Hono {
  const router = new Hono();
  const ListTemplatesQuerySchema = z.object({
    active: z.enum(["true", "false"]).optional(),
    first: z.coerce.number().int().min(1).max(100).default(20),
  });

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
    const parsed = ListTemplatesQuerySchema.safeParse({
      active: c.req.query("active"),
      first: c.req.query("first"),
    });

    if (!parsed.success) {
      return c.json({ error: "Invalid query", details: parsed.error.issues }, 400);
    }

    const { active, first } = parsed.data;
    let data;

    if (active === "true") {
      const query = gql`
        query Templates($first: Int!) {
          jobTemplates(first: $first, orderBy: createdAt, orderDirection: desc, where: { active: true }) {
            ${TEMPLATE_FIELDS}
          }
        }
      `;
      data = await subgraph.request(query, { first });
    } else {
      const query = gql`
        query Templates($first: Int!) {
          jobTemplates(first: $first, orderBy: createdAt, orderDirection: desc) {
            ${TEMPLATE_FIELDS}
          }
        }
      `;
      data = await subgraph.request(query, { first });
    }

    return c.json(data);
  });

  return router;
}
