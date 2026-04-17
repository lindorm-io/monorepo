import { z } from "zod";
import type { ServerHandler } from "../types/context";

export const createWebhookSchema = z.object({
  auth: z.string(),
  event: z.string(),
  method: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  ownerId: z.string(),
  tenantId: z.string().nullable().optional(),
  url: z.string(),

  authHeaders: z.record(z.string(), z.string()).optional(),

  username: z.string().nullable().optional(),
  password: z.string().nullable().optional(),

  audience: z.string().nullable().optional(),
  authLocation: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
  clientSecret: z.string().nullable().optional(),
  contentType: z.string().nullable().optional(),
  issuer: z.string().nullable().optional(),
  scope: z.array(z.string()).optional(),
  tokenUri: z.string().nullable().optional(),
});

export const createWebhookHandler: ServerHandler<typeof createWebhookSchema> = async (
  ctx,
) => {
  const repository = ctx.repositories!.webhookSubscription;
  const subscription = await repository.save(ctx.data);

  return { body: subscription, status: 201 };
};
