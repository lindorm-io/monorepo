import { LindormError } from "@lindorm/errors";
import { Constructor } from "@lindorm/types";
import { LindormWorkerConfig } from "@lindorm/worker";
import {
  MnemosWebhookDispatchEntity,
  MnemosWebhookRequestEntity,
  MnemosWebhookSubscriptionEntity,
  MongoWebhookDispatchEntity,
  MongoWebhookRequestEntity,
  MongoWebhookSubscriptionEntity,
  RedisWebhookDispatchEntity,
  RedisWebhookRequestEntity,
  RedisWebhookSubscriptionEntity,
} from "../../../entities";
import {
  IWebhookDispatchEntity,
  IWebhookRequestEntity,
  IWebhookSubscription,
} from "../../../interfaces";
import {
  PylonEntityRepository,
  PylonEntitySource,
  PylonEntityWebhookOptions,
  PylonSource,
} from "../../../types";
import { getSource } from "../get-source";
import { createWorkerQueueCallback } from "../worker-queue-callback";
import { createWorkerQueueErrorCallback } from "../worker-queue-error-callback";

const getDispatchRepository = (
  source: PylonEntitySource,
): PylonEntityRepository<IWebhookDispatchEntity> => {
  switch (source.__instanceof) {
    case "MnemosSource":
      return source.repository(MnemosWebhookDispatchEntity);

    case "MongoSource":
      return source.repository(MongoWebhookDispatchEntity);

    case "RedisSource":
      return source.repository(RedisWebhookDispatchEntity);

    default:
      throw new LindormError("Unsupported source type", { debug: { source } });
  }
};

const getSubscriptionRepository = (
  source: PylonEntitySource,
): PylonEntityRepository<IWebhookSubscription> => {
  switch (source.__instanceof) {
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

const getRequestTarget = (
  source: PylonEntitySource,
): Constructor<IWebhookRequestEntity> => {
  switch (source.__instanceof) {
    case "MnemosSource":
      return MnemosWebhookRequestEntity;

    case "MongoSource":
      return MongoWebhookRequestEntity;

    case "RedisSource":
      return RedisWebhookRequestEntity;

    default:
      throw new LindormError("Unsupported source type", { debug: { source } });
  }
};

export const createWebhookRequestWorker = (
  options: PylonEntityWebhookOptions,
  sources: Map<string, PylonSource>,
): LindormWorkerConfig => {
  const source = getSource<PylonEntitySource>(sources, options.source);
  const subscriptions = getSource<PylonEntitySource>(sources, options.subscriptions);
  const target = getRequestTarget(source);

  const dispatchRepository = getDispatchRepository(source);
  const subscriptionRepository = getSubscriptionRepository(subscriptions);

  return {
    alias: "WebhookRequestWorker",
    interval: options.worker?.interval ?? "2s",
    listeners: options.worker?.listeners,
    randomize: options.worker?.randomize ?? "1s",
    retry: options.worker?.retry,
    callback: createWorkerQueueCallback({
      source: source,
      target,
      callback: async (_, request) => {
        const subscriptions = await subscriptionRepository.find({ event: request.event });

        if (!subscriptions.length) return;

        await dispatchRepository.insertBulk(
          subscriptions.map((subscription) => ({
            event: request.event,
            payload: request.payload,
            subscription,
          })),
        );
      },
    }),
    errorCallback: createWorkerQueueErrorCallback({
      source: source,
      target,
    }),
  };
};
