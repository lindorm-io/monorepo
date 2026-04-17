import { ConduitClientCredentialsCache } from "@lindorm/conduit";
import { IIrisSource } from "@lindorm/iris";
import { IKryptos } from "@lindorm/kryptos";
import { ILogger } from "@lindorm/logger";
import { IProteusSource } from "@lindorm/proteus";
import { WebhookSubscription } from "../../entities";
import { WebhookDispatch } from "../../messages";
import { createDispatchWebhook } from "../utils/dispatch-webhook";

export const WEBHOOK_DISPATCH_QUEUE = "pylon.webhook.dispatch.send";

const DEFAULT_MAX_ERRORS = 10;

export type SetupWebhookDispatchOptions = {
  encryptionKey?: IKryptos;
  cache?: ConduitClientCredentialsCache;
  maxErrors?: number;
};

export const setupWebhookDispatchConsumer = async (
  iris: IIrisSource,
  proteus: IProteusSource,
  logger: ILogger,
  options: SetupWebhookDispatchOptions = {},
): Promise<void> => {
  const dispatchWebhook = createDispatchWebhook(
    { encryptionKey: options.encryptionKey },
    logger,
    options.cache,
  );

  const maxErrors = options.maxErrors ?? DEFAULT_MAX_ERRORS;

  const wq = iris.workerQueue(WebhookDispatch);

  await wq.consume(WEBHOOK_DISPATCH_QUEUE, async (message) => {
    try {
      await dispatchWebhook({
        event: message.event,
        payload: message.payload,
        subscription: message.subscription,
      });

      logger.debug("Webhook dispatched", {
        event: message.event,
        url: message.subscription.url,
      });
    } catch (error: any) {
      logger.error("Webhook dispatch failed", error, [
        {
          event: message.event,
          subscriptionId: message.subscription.id,
          url: message.subscription.url,
        },
      ]);

      const repo = proteus.repository(WebhookSubscription);
      const subscription = await repo.findOne({ id: message.subscription.id });

      if (!subscription) return;

      subscription.errorCount = (subscription.errorCount ?? 0) + 1;
      subscription.lastErrorAt = new Date();

      if (subscription.errorCount >= maxErrors) {
        subscription.suspendedAt = new Date();
        logger.warn("Webhook subscription suspended", {
          subscriptionId: subscription.id,
          errorCount: subscription.errorCount,
          maxErrors,
        });
      }

      await repo.save(subscription);
    }
  });

  logger.verbose("Webhook dispatch consumer started", {
    queue: WEBHOOK_DISPATCH_QUEUE,
  });
};
