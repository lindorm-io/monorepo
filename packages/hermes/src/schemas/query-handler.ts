import { z } from "zod";

export const QueryHandlerSchema = z.object({
  query: z.function(),
  view: z.string(),
  context: z.string().optional(),
  handler: z.function(),
});
