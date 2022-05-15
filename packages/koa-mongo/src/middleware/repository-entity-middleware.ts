import { ClientError } from "@lindorm-io/errors";
import { EntityBase, EntityNotFoundError } from "@lindorm-io/entity";
import { CustomValidation, DefaultLindormMongoKoaMiddleware } from "../types";
import { RepositoryBase } from "@lindorm-io/mongo";
import { camelCase, get, isFunction, isString } from "lodash";

interface MiddlewareOptions {
  entityKey?: string;
  repositoryKey?: string;
}

export interface RepositoryEntityMiddlewareOptions {
  attributeKey?: string;
  customValidation?: CustomValidation;
  optional?: boolean;
}

export const repositoryEntityMiddleware =
  (
    Entity: typeof EntityBase,
    Repository: typeof RepositoryBase,
    middlewareOptions: MiddlewareOptions = {},
  ) =>
  (
    path: string,
    options: RepositoryEntityMiddlewareOptions = {},
  ): DefaultLindormMongoKoaMiddleware =>
  async (ctx, next): Promise<void> => {
    const metric = ctx.getMetric("entity");

    const { attributeKey = "id", customValidation, optional } = options;
    const attributeValue = get(ctx, path);

    if (!isString(attributeValue) && optional) {
      ctx.logger.debug("optional entity identifier not found", { path });

      metric.end();

      return await next();
    }

    if (!isString(attributeValue)) {
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
    const repository = middlewareOptions.repositoryKey || camelCase(Repository.name);

    try {
      ctx.entity[entity] = await ctx.repository[repository].find({
        [attributeKey]: attributeValue,
      });

      if (isFunction(customValidation)) {
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
