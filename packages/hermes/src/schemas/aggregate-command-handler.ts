import { z } from "zod";

export const AggregateCommandHandlerSchema = z.object({
  command: z.function(),
  conditions: z
    .object({
      created: z.boolean().optional(),
      permanent: z.boolean().optional(),
    })
    .optional(),
  schema: z.instanceof(z.ZodSchema),
  handler: z.function(),
});
