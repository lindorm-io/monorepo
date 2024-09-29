import { z } from "zod";

export const ErrorHandlerSchema = z.object({
  error: z.function(),
  aggregate: z
    .object({
      context: z.union([z.string(), z.array(z.string())]).optional(),
    })
    .optional(),
  handler: z.function(),
});
