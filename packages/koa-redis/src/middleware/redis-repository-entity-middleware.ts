import { CachedEntityCustomValidation, DefaultLindormRedisKoaMiddleware } from "../types";
import { ClientError, ServerError } from "@lindorm-io/errors";
import { EntityBase, EntityNotFoundError } from "@lindorm-io/entity";
import { RedisRepositoryConstructor } from "@lindorm-io/redis";
import { camelCase } from "@lindorm-io/case";
import { get } from "object-path";

interface MiddlewareOptions {
  entityKey?: string;
  repositoryKey?: string;
}

export interface CacheEntityMiddlewareOptions {
  attributeKey?: string;
  customValidation?: CachedEntityCustomValidation;
  optional?: boolean;
}

export const redisRepositoryEntityMiddleware =
  (
    Entity: typeof EntityBase,
    Repository: RedisRepositoryConstructor,
    middlewareOptions: MiddlewareOptions = {},
  ) =>
  (path: string, options: CacheEntityMiddlewareOptions = {}): DefaultLindormRedisKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("entity");

    const { attributeKey = "id", customValidation, optional } = options;
    const attributeValue = get(ctx, path);

    if (typeof attributeValue !== "string" && optional) {
      ctx.logger.debug("optional entity identifier not found", { path });

      metric.end();

      return await next();
    }

    if (typeof attributeValue !== "string") {
      throw new ClientError("Invalid key", {
        debug: {
          path,
          [attributeKey]: attributeValue,
        },
        description: "Entity key expected",
        statusCode: ClientError.StatusCode.BAD_REQUEST,
      });
    }

    const entity = middlewareOptions.entityKey || camelCase(Entity.name);
    const repository = middlewareOptions.repositoryKey || camelCase(Repository.name);

    if (!entity) {
      throw new ServerError("Entity name not found", {
        debug: { name: entity },
      });
    }

    if (!repository) {
      throw new ServerError("Cache name not found", {
        debug: { name: repository },
      });
    }

    if (!ctx.redis[repository]) {
      throw new ServerError("Redis repository not found", {
        debug: { context: ctx.redis },
      });
    }

    try {
      ctx.entity[entity] = await ctx.redis[repository].find({
        [attributeKey]: attributeValue,
      });

      if (customValidation instanceof Function) {
        await customValidation(ctx, ctx.entity[entity]);
      }
    } catch (err: any) {
      if (err instanceof EntityNotFoundError) {
        throw new ClientError(`Invalid ${Entity.name}`, {
          debug: { key: attributeValue },
          error: err,
          statusCode: ClientError.StatusCode.BAD_REQUEST,
        });
      }

      metric.end();

      throw new ClientError(err.message || "Unexpected Error", {
        error: err,
      });
    }

    metric.end();

    await next();
  };
