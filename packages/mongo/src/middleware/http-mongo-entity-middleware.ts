import { camelCase } from "@lindorm/case";
import { IEntity } from "@lindorm/entity";
import { ClientError } from "@lindorm/errors";
import { isObject } from "@lindorm/is";
import { Constructor } from "@lindorm/types";
import { get } from "object-path";
import { IMongoSource } from "../interfaces";
import { MongoPylonHttpContext, MongoPylonHttpMiddleware } from "../types";

type Options = {
  key?: string;
  optional?: boolean;
};

export const createHttpMongoEntityMiddleware =
  <C extends MongoPylonHttpContext = MongoPylonHttpContext>(
    Entity: Constructor<IEntity>,
    source?: IMongoSource,
  ) =>
  (path: string, options: Options = {}): MongoPylonHttpMiddleware<C> => {
    return async function httpMongoEntityMiddleware(ctx, next): Promise<void> {
      const { key = "id", optional = false } = options;
      const value = get(ctx, path);

      if (!value && optional) {
        return await next();
      }

      if (!value) {
        throw new ClientError("Invalid value for repository query", {
          debug: { path, key, value },
        });
      }

      if (!isObject(ctx.entities)) {
        ctx.entities = {};
      }

      const repository = source
        ? source.repository(Entity, { logger: ctx.logger })
        : ctx.sources.mongo.repository(Entity);

      const name = camelCase(Entity.name);

      ctx.entities[name] = await repository.findOneOrFail({ [key]: value });

      await next();
    };
  };
