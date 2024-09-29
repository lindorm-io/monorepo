import { z } from "zod";
import { HermesCommand, HermesError, HermesEvent, HermesTimeout } from "../messages";

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
  topic: z.string(),
  type: z.enum([
    HermesCommand.name,
    HermesError.name,
    HermesEvent.name,
    HermesTimeout.name,
  ]),
  version: z.number(),
});
