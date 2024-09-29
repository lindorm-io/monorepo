import { z } from "zod";

export const ViewEventHandlerSchema = z.object({
  event: z.function(),
  adapter: z.object({
    custom: z.record(z.any()).optional(),
    indexes: z
      .array(
        z.object({
          fields: z.array(z.string()).optional(),
          name: z.string().optional(),
          unique: z.boolean().optional(),
        }),
      )
      .optional(),
    type: z.string().optional(),
  }),
  aggregate: z
    .object({
      name: z.string(),
      context: z.array(z.string()).optional(),
    })
    .optional(),
  conditions: z
    .object({
      created: z.boolean().optional(),
      permanent: z.boolean().optional(),
    })
    .optional(),
  getViewId: z.function(),
  handler: z.function(),
});
