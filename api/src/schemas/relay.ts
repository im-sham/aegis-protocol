import { z } from "zod";

export const RelayRequestSchema = z.object({
  signedTx: z
    .string()
    .regex(/^0x[0-9a-fA-F]+$/, "Must be a hex-encoded signed transaction"),
});

export const RelayResponseSchema = z.object({
  txHash: z.string(),
  blockNumber: z.number().optional(),
  status: z.enum(["pending", "success", "reverted"]),
  events: z
    .array(
      z.object({
        name: z.string(),
        args: z.record(z.unknown()),
      }),
    )
    .optional(),
});

export type RelayRequest = z.infer<typeof RelayRequestSchema>;
export type RelayResponse = z.infer<typeof RelayResponseSchema>;
