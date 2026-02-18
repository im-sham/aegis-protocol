import { z } from "zod";
import type { AegisClient } from "@aegis-protocol/sdk";
import { formatTemplateForLLM } from "../helpers/format.js";

export const getTemplateDef = {
  name: "aegis_get_template",
  description:
    "Get the default parameters for a job template. Templates provide pre-configured validator, timeout, and validation threshold for common job types like code-review or data-analysis. Use a template to create jobs faster with standardized terms.",
  inputSchema: {
    templateId: z
      .string()
      .describe("Template ID (numeric string, e.g. '1')"),
  },
};

export async function handleGetTemplate(
  client: AegisClient,
  args: { templateId: string },
) {
  const id = BigInt(args.templateId);
  const template = await client.factory.getTemplate(id);
  return formatTemplateForLLM(args.templateId, template);
}
