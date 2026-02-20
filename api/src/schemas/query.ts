import { z } from "zod";

export const PaginationSchema = z.object({
  first: z.coerce.number().int().min(1).max(100).default(20),
  skip: z.coerce.number().int().min(0).default(0),
});

export const JobQuerySchema = PaginationSchema.extend({
  state: z
    .enum([
      "CREATED",
      "FUNDED",
      "DELIVERED",
      "VALIDATING",
      "DISPUTE_WINDOW",
      "SETTLED",
      "DISPUTED",
      "RESOLVED",
      "EXPIRED",
      "REFUNDED",
      "CANCELLED",
    ])
    .optional(),
  client: z.string().optional(),
  provider: z.string().optional(),
});

export const HexParamSchema = z.object({
  id: z.string().regex(/^0x[0-9a-fA-F]+$/, "Must be a hex string"),
});

export const AddressParamSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid address"),
});

export const AgentIdParamSchema = z.object({
  id: z.coerce.bigint(),
});
