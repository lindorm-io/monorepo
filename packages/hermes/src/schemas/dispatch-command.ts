import { z } from "zod/v4";
import { HermesMessageSchema } from "./hermes-message";

export const DispatchMessageSchema = z.object({
  causation: HermesMessageSchema,
  message: z.looseObject({}),
  options: z
    .object({
      id: z.string().optional(),
      delay: z.number().optional(),
      mandatory: z.boolean().optional(),
      meta: z.record(z.string(), z.any()).optional(),
    })
    .optional(),
});
