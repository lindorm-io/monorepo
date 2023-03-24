import { ClientError, ServerError } from "@lindorm-io/errors";
import { DefaultLindormMiddleware } from "@lindorm-io/koa";
import { EntityBase, EntityNotFoundError } from "@lindorm-io/entity";
import { StoredEntityCustomValidation } from "../types";
import { camelCase } from "@lindorm-io/case";
import { get } from "object-path";
import { MemoryCacheConstructor } from "@lindorm-io/in-memory-cache";

type MiddlewareOptions = {
  entityKey?: string;
  cacheKey?: string;
};

export type MemoryCacheEntityMiddlewareOptions = {
  attributeKey?: string;
  customValidation?: StoredEntityCustomValidation;
  optional?: boolean;
};

export const memoryCacheEntityMiddleware =
  (
    Entity: typeof EntityBase,
    MemoryCache: MemoryCacheConstructor,
    middlewareOptions: MiddlewareOptions = {},
  ) =>
  (path: string, options: MemoryCacheEntityMiddlewareOptions = {}): DefaultLindormMiddleware =>
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
      throw new ClientError("Invalid id", {
        debug: {
          path,
          [attributeKey]: attributeValue,
        },
        description: "Entity key expected",
        statusCode: ClientError.StatusCode.BAD_REQUEST,
      });
    }

    const entity = middlewareOptions.entityKey || camelCase(Entity.name);
    const cache = middlewareOptions.cacheKey || camelCase(MemoryCache.name);

    if (!entity) {
      throw new ServerError("Entity name not found", {
        debug: { name: entity },
      });
    }

    if (!cache) {
      throw new ServerError("Repository name not found", {
        debug: { name: cache },
      });
    }

    if (!ctx.memory[cache]) {
      throw new ServerError("Mongo cache not found", {
        debug: { context: ctx.memory },
      });
    }

    try {
      ctx.entity[entity] = await ctx.memory[cache].find({
        [attributeKey]: attributeValue,
      });

      if (customValidation instanceof Function) {
        await customValidation(ctx, ctx.entity[entity]);
      }
    } catch (err: any) {
      if (err instanceof EntityNotFoundError) {
        throw new ClientError(`Invalid ${Entity.name}`, {
          debug: { id: attributeValue },
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
