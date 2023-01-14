import { CacheBase } from "@lindorm-io/redis";
import { CachedEntityCustomValidation, DefaultLindormRedisKoaMiddleware } from "../types";
import { ClientError } from "@lindorm-io/errors";
import { EntityBase, EntityNotFoundError } from "@lindorm-io/entity";
import { camelCase } from "@lindorm-io/case";
import { get } from "lodash";

interface MiddlewareOptions {
  cacheKey?: string;
  entityKey?: string;
}

export interface CacheEntityMiddlewareOptions {
  attributeKey?: string;
  customValidation?: CachedEntityCustomValidation;
  optional?: boolean;
}

export const cacheEntityMiddleware =
  (Entity: typeof EntityBase, Cache: typeof CacheBase, middlewareOptions: MiddlewareOptions = {}) =>
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
    const cache = middlewareOptions.cacheKey || camelCase(Cache.name);

    try {
      ctx.entity[entity] = await ctx.cache[cache].find({
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
