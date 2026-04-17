import { ClientError } from "@lindorm/errors";
import { z } from "zod/v4";
import type { ServerHandler } from "../types/context";

export const deleteWebhookSchema = z.object({
  id: z.string(),
});

export const deleteWebhookHandler: ServerHandler<typeof deleteWebhookSchema> = async (
  ctx,
) => {
  const repository = ctx.repositories!.webhookSubscription;
  const existing = await repository.findOne({ id: ctx.data.id });

  if (!existing) {
    throw new ClientError("Webhook subscription not found", {
      status: ClientError.Status.NotFound,
    });
  }

  await repository.destroy(existing);

  return { status: 204 };
};
