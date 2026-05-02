import { ClientError } from "@lindorm/errors";
import { WebhookSubscription } from "@lindorm/pylon/entities";
import { z } from "zod";
import type { ServerHandler } from "../../types/context.js";

export const getWebhookSchema = z.object({
  id: z.string(),
});

export const getWebhookHandler: ServerHandler<typeof getWebhookSchema> = async (ctx) => {
  const repository = ctx.proteus!.repository(WebhookSubscription);
  const subscription = await repository.findOne({ id: ctx.data.id });

  if (!subscription) {
    throw new ClientError("Webhook subscription not found", {
      status: ClientError.Status.NotFound,
    });
  }

  return { body: subscription };
};
