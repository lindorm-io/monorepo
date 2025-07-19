import { LindormError, ServerError } from "@lindorm/errors";
import { NUMERIC_PRIORITY } from "../../constants/private";
import { MnemosJobEntity, MongoJobEntity, RedisJobEntity } from "../../entities";
import { IJob, IJobEntity } from "../../interfaces";
import { PylonJob } from "../../messages";
import {
  PylonCommonContext,
  PylonEntityQueueOptions,
  PylonEntityRepository,
  PylonMessageBus,
  PylonMessageQueueOptions,
  PylonQueueCallback,
  PylonQueueOptions,
  PylonSource,
} from "../../types";
import { getSource } from "./get-source";

export const addQueueEntities = (
  options: PylonEntityQueueOptions,
  sources: Map<string, PylonSource>,
): void => {
  const source = getSource(sources, options.source);

  switch (source.name) {
    case "MnemosSource":
      source.addEntities([MnemosJobEntity]);
      break;

    case "MongoSource":
      source.addEntities([MongoJobEntity]);
      break;

    case "RedisSource":
      source.addEntities([RedisJobEntity]);
      break;

    default:
      break;
  }
};

export const addQueueMessages = (
  options: PylonMessageQueueOptions,
  sources: Map<string, PylonSource>,
): void => {
  const source = getSource(sources, options.source);

  switch (source.name) {
    case "KafkaSource":
    case "RabbitSource":
    case "RedisSource":
      source.addMessages([PylonJob]);
      break;

    default:
      break;
  }
};

const messageBus = (
  ctx: PylonCommonContext,
  options: PylonMessageQueueOptions,
): PylonMessageBus<IJob> => {
  switch (options.source) {
    case "KafkaSource":
      if (!ctx.kafka?.source) {
        throw new ServerError("KafkaSource is not configured");
      }
      return ctx.kafka.source.messageBus(PylonJob);

    case "RabbitSource":
      if (!ctx.rabbit?.source) {
        throw new ServerError("RabbitSource is not configured");
      }
      return ctx.rabbit.source.messageBus(PylonJob);

    case "RedisSource":
      if (!ctx.redis?.source) {
        throw new ServerError("RedisSource is not configured");
      }
      return ctx.redis.source.messageBus(PylonJob);

    default:
      throw new LindormError("Unsupported source type");
  }
};

const repository = (
  ctx: PylonCommonContext,
  options: PylonEntityQueueOptions,
): PylonEntityRepository<IJobEntity> => {
  switch (options.source) {
    case "MnemosSource":
      if (!ctx.mnemos?.source) {
        throw new ServerError("MnemosSource is not configured");
      }
      return ctx.mnemos.source.repository(MnemosJobEntity);

    case "MongoSource":
      if (!ctx.mongo?.source) {
        throw new ServerError("MongoSource is not configured");
      }
      return ctx.mongo.source.repository(MongoJobEntity);

    case "RedisSource":
      if (!ctx.redis?.source) {
        throw new ServerError("RedisSource is not configured");
      }
      return ctx.redis.source.repository(RedisJobEntity);

    default:
      throw new LindormError("Unsupported source type");
  }
};

export const createQueueCallback = (
  options?: PylonQueueOptions,
): PylonQueueCallback | undefined => {
  switch (options?.use) {
    case "custom":
      return options.custom;

    case "message":
      return async function queueCallback(ctx, event, payload, priority) {
        await messageBus(ctx, options).publish({
          event,
          payload,
          priority: NUMERIC_PRIORITY[priority],
        });
      };

    case "entity":
      return async function queueCallback(ctx, event, payload, priority) {
        await repository(ctx, options).insert({
          event,
          payload,
          priority: NUMERIC_PRIORITY[priority],
        });
      };

    default:
      return;
  }
};
