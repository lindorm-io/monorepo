import { ClientError } from "@lindorm/errors";
import { WebhookSubscription } from "@lindorm/pylon";
import { z } from "zod";
import type { ServerHandler } from "../types/context.js";

export const deleteWebhookSchema = z.object({
  id: z.string(),
});

export const deleteWebhookHandler: ServerHandler<typeof deleteWebhookSchema> = async (
  ctx,
) => {
  const repository = ctx.proteus!.repository(WebhookSubscription);
  const existing = await repository.findOne({ id: ctx.data.id });

  if (!existing) {
    throw new ClientError("Webhook subscription not found", {
      status: ClientError.Status.NotFound,
    });
  }

  await repository.destroy(existing);

  return { status: 204 };
};
