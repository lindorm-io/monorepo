import { LindormError, ServerError } from "@lindorm/errors";
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
} from "../../entities";
import { IWebhookRequest, IWebhookRequestEntity } from "../../interfaces";
import { PylonWebhookDispatch, PylonWebhookRequest } from "../../messages";
import {
  PylonCommonContext,
  PylonEntityRepository,
  PylonEntitySource,
  PylonEntityWebhookOptions,
  PylonMessageBus,
  PylonMessageSource,
  PylonMessageWebhookOptions,
  PylonSource,
  PylonWebhookCallback,
  PylonWebhookOptions,
} from "../../types";
import { getSource } from "./get-source";

export const addWebhookEntities = (
  options: PylonEntityWebhookOptions,
  sources: Map<string, PylonSource>,
): void => {
  const source = getSource(sources, options.source);

  switch (source.name) {
    case "MnemosSource":
      source.addEntities([MnemosWebhookDispatchEntity, MnemosWebhookRequestEntity]);
      break;

    case "MongoSource":
      source.addEntities([MongoWebhookDispatchEntity, MongoWebhookRequestEntity]);
      break;

    case "RedisSource":
      source.addEntities([RedisWebhookDispatchEntity, RedisWebhookRequestEntity]);
      break;

    default:
      break;
  }

  const subscriptions = getSource(sources, options.subscriptions);

  switch (subscriptions.name) {
    case "MnemosSource":
      subscriptions.addEntities([MnemosWebhookSubscriptionEntity]);
      break;

    case "MongoSource":
      subscriptions.addEntities([MongoWebhookSubscriptionEntity]);
      break;

    case "RedisSource":
      subscriptions.addEntities([RedisWebhookSubscriptionEntity]);
      break;

    default:
      break;
  }
};

export const addWebhookMessages = (
  options: PylonMessageWebhookOptions,
  sources: Map<string, PylonSource>,
): void => {
  const source = getSource<PylonMessageSource>(sources, options.source);

  switch (options.source) {
    case "KafkaSource":
    case "RabbitSource":
    case "RedisSource":
      source.addMessages([PylonWebhookDispatch, PylonWebhookRequest]);
      break;

    default:
      break;
  }

  const subscriptions = getSource<PylonEntitySource>(sources, options.subscriptions);

  switch (options.subscriptions) {
    case "MnemosSource":
      subscriptions.addEntities([MnemosWebhookSubscriptionEntity]);
      break;

    case "MongoSource":
      subscriptions.addEntities([MongoWebhookSubscriptionEntity]);
      break;

    case "RedisSource":
      subscriptions.addEntities([RedisWebhookSubscriptionEntity]);
      break;

    default:
      break;
  }
};

const messageBus = (
  ctx: PylonCommonContext,
  options: PylonMessageWebhookOptions,
): PylonMessageBus<IWebhookRequest> => {
  switch (options.source) {
    case "KafkaSource":
      if (!ctx.kafka?.source) {
        throw new ServerError("KafkaSource is not configured");
      }
      return ctx.kafka.source.messageBus(PylonWebhookRequest);

    case "RabbitSource":
      if (!ctx.rabbit?.source) {
        throw new ServerError("RabbitSource is not configured");
      }
      return ctx.rabbit.source.messageBus(PylonWebhookRequest);

    case "RedisSource":
      if (!ctx.redis?.source) {
        throw new ServerError("RedisSource is not configured");
      }
      return ctx.redis.source.messageBus(PylonWebhookRequest);

    default:
      throw new LindormError("Unsupported source type");
  }
};

const repository = (
  ctx: PylonCommonContext,
  options: PylonEntityWebhookOptions,
): PylonEntityRepository<IWebhookRequestEntity> => {
  switch (options.source) {
    case "MnemosSource":
      if (!ctx.mnemos?.source) {
        throw new ServerError("MnemosSource is not configured");
      }
      return ctx.mnemos.source.repository(MnemosWebhookRequestEntity);

    case "MongoSource":
      if (!ctx.mongo?.source) {
        throw new ServerError("MongoSource is not configured");
      }
      return ctx.mongo.source.repository(MongoWebhookRequestEntity);

    case "RedisSource":
      if (!ctx.redis?.source) {
        throw new ServerError("RedisSource is not configured");
      }
      return ctx.redis.source.repository(RedisWebhookRequestEntity);

    default:
      throw new LindormError("Unsupported source type");
  }
};

export const createWebhookCallback = (
  options?: PylonWebhookOptions,
): PylonWebhookCallback | undefined => {
  switch (options?.use) {
    case "custom":
      return options.custom;

    case "message":
      return async function pylonWebhookCallback(ctx, event, payload) {
        await messageBus(ctx, options).publish({ event, payload });
      };

    case "entity":
      return async function pylonWebhookCallback(ctx, event, payload) {
        await repository(ctx, options).insert({ event, payload });
      };

    default:
      return;
  }
};
