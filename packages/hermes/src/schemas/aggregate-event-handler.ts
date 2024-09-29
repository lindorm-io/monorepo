import { z } from "zod";

export const AggregateEventHandlerSchema = z.object({
  event: z.function(),
  handler: z.function(),
});
