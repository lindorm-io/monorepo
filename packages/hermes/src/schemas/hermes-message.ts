import { z } from "zod";

export const HermesMessageSchema = z.object({
  id: z.string().uuid(),
  aggregate: z.object({
    id: z.string(),
    name: z.string(),
    context: z.string(),
  }),
  causationId: z.string().uuid(),
  correlationId: z.string().uuid(),
  data: z.record(z.any()),
  delay: z.number(),
  mandatory: z.boolean(),
  meta: z.record(z.any()),
  name: z.string(),
  timestamp: z.date(),
  version: z.number(),
});
