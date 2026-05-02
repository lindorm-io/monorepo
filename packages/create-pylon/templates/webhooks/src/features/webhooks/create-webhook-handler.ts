import { WebhookAuth, WebhookMethod } from "@lindorm/pylon";
import { WebhookSubscription } from "@lindorm/pylon/entities";
import { z } from "zod";
import type { ServerHandler } from "../../types/context.js";

export const createWebhookSchema = z.object({
  auth: z.nativeEnum(WebhookAuth),
  event: z.string(),
  method: z.nativeEnum(WebhookMethod).optional(),
  headers: z.record(z.string(), z.string()),
  ownerId: z.string(),
  tenantId: z.string().nullable().optional(),
  url: z.string().url(),

  authHeaders: z.record(z.string(), z.string()),

  username: z.string().nullable().optional(),
  password: z.string().nullable().optional(),

  audience: z.string().nullable().optional(),
  authLocation: z.enum(["body", "header"]).nullable().optional(),
  clientId: z.string().nullable().optional(),
  clientSecret: z.string().nullable().optional(),
  contentType: z
    .enum(["application/json", "application/x-www-form-urlencoded"])
    .nullable()
    .optional(),
  issuer: z.string().nullable().optional(),
  scope: z.array(z.string()).optional(),
  tokenUri: z.string().url().nullable().optional(),
});

export const createWebhookHandler: ServerHandler<typeof createWebhookSchema> = async (
  ctx,
) => {
  const repository = ctx.proteus!.repository(WebhookSubscription);
  const subscription = await repository.save(ctx.data);

  return { body: subscription, status: 201 };
};
