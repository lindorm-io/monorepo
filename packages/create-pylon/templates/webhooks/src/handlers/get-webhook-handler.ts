import { ClientError } from "@lindorm/errors";
import { z } from "zod/v4";
import type { ServerHandler } from "../types/context";

export const getWebhookSchema = z.object({
  id: z.string(),
});

export const getWebhookHandler: ServerHandler<typeof getWebhookSchema> = async (ctx) => {
  const repository = ctx.repositories!.webhookSubscription;
  const subscription = await repository.findOne({ id: ctx.data.id });

  if (!subscription) {
    throw new ClientError("Webhook subscription not found", {
      status: ClientError.Status.NotFound,
    });
  }

  return { body: subscription };
};
