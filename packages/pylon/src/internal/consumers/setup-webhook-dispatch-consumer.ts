import { ConduitClientCredentialsCache } from "@lindorm/conduit";
import { IIrisSource } from "@lindorm/iris";
import { IKryptos } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { WebhookDispatch } from "../../messages";
import { createDispatchWebhook } from "../utils/dispatch-webhook";

export const WEBHOOK_DISPATCH_QUEUE = "pylon.webhook.dispatch.send";

export type SetupWebhookDispatchOptions = {
  encryptionKey?: IKryptos;
  cache?: ConduitClientCredentialsCache;
};

export const setupWebhookDispatchConsumer = async (
  iris: IIrisSource,
  logger: ILogger,
  options: SetupWebhookDispatchOptions = {},
): Promise<void> => {
  const dispatchWebhook = createDispatchWebhook(
    { encryptionKey: options.encryptionKey },
    logger,
    options.cache,
  );

  const wq = iris.workerQueue(WebhookDispatch);

  await wq.consume(WEBHOOK_DISPATCH_QUEUE, async (message) => {
    await dispatchWebhook({
      event: message.event,
      payload: message.payload,
      subscription: message.subscription,
    });

    logger.debug("Webhook dispatched", {
      event: message.event,
      url: message.subscription.url,
    });
  });

  logger.verbose("Webhook dispatch consumer started", {
    queue: WEBHOOK_DISPATCH_QUEUE,
  });
};
