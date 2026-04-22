import { z } from "zod";
import type { ServerHandler } from "../types/context.js";

export const listWebhooksSchema = z.object({
  ownerId: z.string(),
  tenantId: z.string().nullable().optional(),
});

export const listWebhooksHandler: ServerHandler<typeof listWebhooksSchema> = async (
  ctx,
) => {
  const repository = ctx.repositories!.webhookSubscription;
  const query: { ownerId: string; tenantId?: string | null } = {
    ownerId: ctx.data.ownerId,
  };

  if (ctx.data.tenantId !== undefined) {
    query.tenantId = ctx.data.tenantId;
  }

  const subscriptions = await repository.find(query);

  return { body: subscriptions };
};
