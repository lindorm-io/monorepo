import { IIrisSource } from "@lindorm/iris";
import { ILogger } from "@lindorm/logger";
import { IProteusSource } from "@lindorm/proteus";
import { WebhookSubscription } from "../../entities";
import { WebhookDispatch, WebhookRequest } from "../../messages";

export const WEBHOOK_REQUEST_QUEUE = "pylon.webhook.request.fanout";

export const setupWebhookRequestConsumer = async (
  iris: IIrisSource,
  proteus: IProteusSource,
  logger: ILogger,
): Promise<void> => {
  const wq = iris.workerQueue(WebhookRequest);

  await wq.consume(WEBHOOK_REQUEST_QUEUE, async (message) => {
    const repo = proteus.repository(WebhookSubscription);
    const subscriptions = await repo.find({ event: message.event });

    if (!subscriptions.length) {
      logger.debug("No webhook subscriptions found for event", {
        event: message.event,
      });
      return;
    }

    const dispatchQueue = iris.workerQueue(WebhookDispatch);

    for (const subscription of subscriptions) {
      const dispatch = dispatchQueue.create({
        correlationId: message.correlationId,
        event: message.event,
        payload: message.payload,
        subscription,
      });
      await dispatchQueue.publish(dispatch);
    }

    logger.debug("Webhook dispatches published", {
      event: message.event,
      count: subscriptions.length,
    });
  });

  logger.verbose("Webhook request consumer started", {
    queue: WEBHOOK_REQUEST_QUEUE,
  });
};
