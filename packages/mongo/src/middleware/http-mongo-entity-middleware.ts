import { camelCase } from "@lindorm/case";
import { ClientError } from "@lindorm/errors";
import { Constructor } from "@lindorm/types";
import { get } from "object-path";
import { MongoPylonHttpContext, MongoPylonHttpMiddleware } from "../types";
import { IEntity } from "@lindorm/entity";

type Options = {
  key?: string;
  optional?: boolean;
};

export const createHttpMongoEntityMiddleware =
  <C extends MongoPylonHttpContext = MongoPylonHttpContext>(
    Entity: Constructor<IEntity>,
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

      if (!ctx.entities) {
        ctx.entities = {};
      }

      const repository = ctx.mongo.repository(Entity);
      const name = camelCase(Entity.name);

      ctx.entities[name] = await repository.findOneOrFail({ [key]: value });

      await next();
    };
  };
