import z from "zod";
import { HermesMessageSchema } from "./hermes-message";

export const DispatchMessageSchema = z.object({
  causation: HermesMessageSchema,
  message: z.record(z.any()),
  options: z
    .object({
      id: z.string().optional(),
      delay: z.number().optional(),
      mandatory: z.boolean().optional(),
      meta: z.record(z.any()).optional(),
    })
    .optional(),
});
