import { ConduitClientCredentialsCache } from "@lindorm/conduit";
import { LindormError } from "@lindorm/errors";
import { ILogger } from "@lindorm/logger";
import {
  WEBHOOK_DISPATCH_TOPIC,
  WEBHOOK_REQUEST_TOPIC,
} from "../../../constants/private";
import {
  MnemosWebhookSubscriptionEntity,
  MongoWebhookSubscriptionEntity,
  RedisWebhookSubscriptionEntity,
} from "../../../entities";
import {
  IWebhookDispatch,
  IWebhookRequest,
  IWebhookSubscription,
} from "../../../interfaces";
import { PylonWebhookDispatch, PylonWebhookRequest } from "../../../messages";
import {
  PylonEntityRepository,
  PylonEntitySource,
  PylonMessageBus,
  PylonMessageSource,
  PylonMessageWebhookOptions,
  PylonSource,
  PylonSubscribeOptions,
} from "../../../types";
import { createDispatchWebhook } from "../dispatch-webhook";
import { getSource } from "../get-source";

const getMessageBus = (source: PylonMessageSource): PylonMessageBus<IWebhookDispatch> => {
  switch (source.name) {
    case "KafkaSource":
    case "RabbitSource":
    case "RedisSource":
      return source.messageBus(PylonWebhookDispatch);

    default:
      throw new LindormError("Unsupported source type", { debug: { source } });
  }
};

const getSubscriptionRepository = (
  source: PylonEntitySource,
): PylonEntityRepository<IWebhookSubscription> => {
  switch (source.name) {
    case "MnemosSource":
      return source.repository(MnemosWebhookSubscriptionEntity);

    case "MongoSource":
      return source.repository(MongoWebhookSubscriptionEntity);

    case "RedisSource":
      return source.repository(RedisWebhookSubscriptionEntity);

    default:
      throw new LindormError("Unsupported source type", { debug: { source } });
  }
};

export const createWehbookDispatchSubscription = (
  options: PylonMessageWebhookOptions,
  logger: ILogger,
  cache: ConduitClientCredentialsCache = [],
): PylonSubscribeOptions => {
  const dispatch = createDispatchWebhook(options, logger, cache);

  return {
    target: PylonWebhookDispatch,
    topic: WEBHOOK_DISPATCH_TOPIC,
    callback: async (webhook: IWebhookDispatch): Promise<void> => await dispatch(webhook),
  };
};

export const createWehbookRequestSubscription = (
  options: PylonMessageWebhookOptions,
  sources: Map<string, PylonSource>,
): PylonSubscribeOptions => {
  const source = getSource<PylonMessageSource>(sources, options.source);
  const subscriptions = getSource<PylonEntitySource>(sources, options.subscriptions);

  const messageBus = getMessageBus(source);
  const repository = getSubscriptionRepository(subscriptions);

  return {
    target: PylonWebhookRequest,
    topic: WEBHOOK_REQUEST_TOPIC,
    callback: async (request: IWebhookRequest): Promise<void> => {
      const subscriptions = await repository.find({ event: request.event });

      if (!subscriptions.length) return;

      await messageBus.publish(
        subscriptions.map((subscription) => ({
          event: request.event,
          payload: request.payload,
          subscription,
        })),
      );
    },
  };
};
