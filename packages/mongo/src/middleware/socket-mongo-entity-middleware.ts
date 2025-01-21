import { camelCase } from "@lindorm/case";
import { IEntity } from "@lindorm/entity";
import { ClientError } from "@lindorm/errors";
import { isObject } from "@lindorm/is";
import { Constructor } from "@lindorm/types";
import { get } from "object-path";
import { IMongoSource } from "../interfaces";
import { MongoPylonEventContext, MongoPylonEventMiddleware } from "../types";

type Options = {
  key?: string;
  optional?: boolean;
};

export const createSocketMongoEntityMiddleware =
  <C extends MongoPylonEventContext = MongoPylonEventContext>(
    Entity: Constructor<IEntity>,
    source?: IMongoSource,
  ) =>
  (path: string, options: Options = {}): MongoPylonEventMiddleware<C> => {
    return async function socketMongoEntityMiddleware(ctx, next): Promise<void> {
      const { key = "id", optional = false } = options;
      const value = get(ctx, path);

      if (!isObject(ctx.entities)) {
        ctx.entities = {};
      }

      if (!value && optional) {
        return await next();
      }

      if (!value) {
        throw new ClientError("Invalid value for repository query", {
          debug: { path, key, value },
        });
      }

      const repository = source
        ? source.repository(Entity, { logger: ctx.logger })
        : ctx.sources.mongo.repository(Entity);

      const name = camelCase(Entity.name);
      const found = await repository.findOne({ [key]: value });

      if (found) {
        ctx.entities[name] = found;

        ctx.logger.debug("Mongo Entity added to event context", {
          name,
          key,
          value,
        });
      } else if (!optional) {
        throw new ClientError("Entity not found", {
          debug: { key, value, name },
          status: ClientError.Status.NotFound,
        });
      }

      await next();
    };
  };
