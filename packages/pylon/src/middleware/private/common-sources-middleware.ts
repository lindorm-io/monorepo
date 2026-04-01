import { camelCase } from "@lindorm/case";
import { IEntity } from "@lindorm/entity";
import { ServerError } from "@lindorm/errors";
import { IHermes } from "@lindorm/hermes";
import { IMessage } from "@lindorm/message";
import { Middleware } from "@lindorm/middleware";
import { Constructor } from "@lindorm/types";
import { PylonCommonContext, PylonSource } from "../../types";

type Options = {
  hermes?: IHermes;
  entities?: Array<Constructor<IEntity>>;
  messages?: Array<Constructor<IMessage>>;
  sources?: Array<PylonSource>;
};

const publisherName = (target: Constructor<IMessage>): string => {
  return `${camelCase(target.name ?? target.constructor.name)}Publisher`;
};

const repositoryName = (target: Constructor<IEntity>): string => {
  return `${camelCase(target.name ?? target.constructor.name)}Repository`;
};

export const createSourcesMiddleware = <C extends PylonCommonContext>(
  options: Options,
): Middleware<C> => {
  const kafka = options.sources?.find((source) => source.__instanceof === "KafkaSource");
  const mnemos = options.sources?.find(
    (source) => source.__instanceof === "MnemosSource",
  );
  const mongo = options.sources?.find((source) => source.__instanceof === "MongoSource");
  const rabbit = options.sources?.find(
    (source) => source.__instanceof === "RabbitSource",
  );
  const redis = options.sources?.find((source) => source.__instanceof === "RedisSource");

  const entities = options.entities || [];
  const messages = options.messages || [];

  const kafkaMessages = kafka
    ? messages.filter((target) => kafka.hasMessage(target))
    : [];
  const mnemosEntities = mnemos
    ? entities.filter((target) => mnemos.hasEntity(target))
    : [];
  const mongoEntities = mongo ? entities.filter((target) => mongo.hasEntity(target)) : [];
  const rabbitMessages = rabbit
    ? messages.filter((target) => rabbit.hasMessage(target))
    : [];
  const redisEntities = redis ? entities.filter((target) => redis.hasEntity(target)) : [];
  const redisMessages = redis
    ? messages.filter((target) => redis.hasMessage(target))
    : [];

  return async function sourcesMiddleware(ctx, next) {
    const timer = ctx.logger.time();

    try {
      ctx.hermes = options.hermes?.clone({ logger: ctx.logger });

      if (kafka) {
        ctx.kafka = {
          source: kafka.clone({ logger: ctx.logger }),
          publishers: kafkaMessages.reduce(
            (acc, target) => ({
              ...acc,
              [publisherName(target)]: kafka.publisher(target),
            }),
            {},
          ),
        };
        ctx.logger.debug("KafkaSource added to context");
      }

      if (mnemos) {
        ctx.mnemos = {
          source: mnemos.clone({ logger: ctx.logger }),
          repositories: mnemosEntities.reduce(
            (acc, target) => ({
              ...acc,
              [repositoryName(target)]: mnemos.repository(target),
            }),
            {},
          ),
        };
        ctx.logger.debug("MnemosSource added to context", {
          repositories: Object.keys(ctx.mnemos.repositories),
        });
      }

      if (mongo) {
        ctx.mongo = {
          source: mongo.clone({ logger: ctx.logger }),
          repositories: mongoEntities.reduce(
            (acc, target) => ({
              ...acc,
              [repositoryName(target)]: mongo.repository(target),
            }),
            {},
          ),
        };
        ctx.logger.debug("MongoSource added to context", {
          repositories: Object.keys(ctx.mongo.repositories),
        });
      }

      if (rabbit) {
        ctx.rabbit = {
          source: rabbit.clone({ logger: ctx.logger }),
          publishers: rabbitMessages.reduce(
            (acc, target) => ({
              ...acc,
              [publisherName(target)]: rabbit.publisher(target),
            }),
            {},
          ),
        };
        ctx.logger.debug("RabbitSource added to context");
      }

      if (redis) {
        ctx.redis = {
          source: redis.clone({ logger: ctx.logger }),
          publishers: redisMessages.reduce(
            (acc, target) => ({
              ...acc,
              [publisherName(target)]: redis.publisher(target),
            }),
            {},
          ),
          repositories: redisEntities.reduce(
            (acc, target) => ({
              ...acc,
              [repositoryName(target)]: redis.repository(target),
            }),
            {},
          ),
        };
        ctx.logger.debug("RedisSource added to context", {
          repositories: Object.keys(ctx.redis.repositories),
        });
      }

      timer.debug("Sources added to context");
    } catch (error: any) {
      timer.debug("Failed to add sources to context");

      throw new ServerError("Failed to add sources to context", { error });
    }

    await next();
  };
};
