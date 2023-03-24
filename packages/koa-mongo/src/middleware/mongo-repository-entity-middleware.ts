import { ClientError, ServerError } from "@lindorm-io/errors";
import { DefaultLindormMongoKoaMiddleware, StoredEntityCustomValidation } from "../types";
import { EntityBase, EntityNotFoundError } from "@lindorm-io/entity";
import { MongoRepositoryConstructor } from "@lindorm-io/mongo";
import { camelCase } from "@lindorm-io/case";
import { get } from "object-path";

type MiddlewareOptions = {
  entityKey?: string;
  repositoryKey?: string;
};

export type RepositoryEntityMiddlewareOptions = {
  attributeKey?: string;
  customValidation?: StoredEntityCustomValidation;
  optional?: boolean;
};

export const mongoRepositoryEntityMiddleware =
  (
    Entity: typeof EntityBase,
    MongoRepository: MongoRepositoryConstructor,
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
    const repository = middlewareOptions.repositoryKey || camelCase(MongoRepository.name);

    if (!entity) {
      throw new ServerError("Entity name not found", {
        debug: { name: entity },
      });
    }

    if (!repository) {
      throw new ServerError("Repository name not found", {
        debug: { name: repository },
      });
    }

    if (!ctx.mongo[repository]) {
      throw new ServerError("Mongo repository not found", {
        debug: { context: ctx.mongo },
      });
    }

    try {
      ctx.entity[entity] = await ctx.mongo[repository].find({
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
