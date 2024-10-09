import { camelCase } from "@lindorm/case";
import { IEntity } from "@lindorm/entity";
import { ClientError } from "@lindorm/errors";
import { Constructor } from "@lindorm/types";
import { get } from "object-path";
import { MongoPylonEventContext, MongoPylonEventMiddleware } from "../types";

type Options = {
  key?: string;
  optional?: boolean;
};

export const createSocketMongoEntityMiddleware =
  <C extends MongoPylonEventContext = MongoPylonEventContext>(
    Entity: Constructor<IEntity>,
  ) =>
  (path: string, options: Options = {}): MongoPylonEventMiddleware<C> => {
    return async function socketMongoEntityMiddleware(ctx, next): Promise<void> {
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
