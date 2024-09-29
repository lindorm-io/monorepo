import { z } from "zod";

export const SagaEventHandlerSchema = z.object({
  event: z.function(),
  aggregate: z
    .object({
      name: z.string(),
      context: z.union([z.string(), z.array(z.string())]),
    })
    .optional(),
  conditions: z
    .object({
      created: z.boolean().optional(),
      permanent: z.boolean().optional(),
    })
    .optional(),
  getSagaId: z.function(),
  handler: z.function(),
});
