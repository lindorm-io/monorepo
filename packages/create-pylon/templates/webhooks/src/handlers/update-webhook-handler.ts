import { ClientError } from "@lindorm/errors";
import { WebhookMethod } from "@lindorm/pylon";
import { z } from "zod";
import type { ServerHandler } from "../types/context.js";

export const updateWebhookSchema = z.object({
  id: z.string(),

  event: z.string().optional(),
  method: z.nativeEnum(WebhookMethod).optional(),
  headers: z.record(z.string(), z.string()),
  tenantId: z.string().nullable().optional(),
  url: z.string().url().optional(),

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

export const updateWebhookHandler: ServerHandler<typeof updateWebhookSchema> = async (
  ctx,
) => {
  const repository = ctx.repositories!.webhookSubscription;
  const existing = await repository.findOne({ id: ctx.data.id });

  if (!existing) {
    throw new ClientError("Webhook subscription not found", {
      status: ClientError.Status.NotFound,
    });
  }

  const { id: _ignored, ...changes } = ctx.data;

  const updated = await repository.save({
    ...existing,
    ...changes,
    errorCount: 0,
    suspendedAt: null,
  });

  return { body: updated };
};
