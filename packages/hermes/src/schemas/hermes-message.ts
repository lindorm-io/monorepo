import { z } from "zod/v4";

export const HermesMessageSchema = z.object({
  id: z.uuid(),
  aggregate: z.object({
    id: z.string(),
    name: z.string(),
    namespace: z.string(),
  }),
  causationId: z.uuid(),
  correlationId: z.uuid(),
  data: z.record(z.string(), z.any()),
  delay: z.number(),
  mandatory: z.boolean(),
  meta: z.record(z.string(), z.any()),
  name: z.string(),
  timestamp: z.date(),
  version: z.number(),
});
