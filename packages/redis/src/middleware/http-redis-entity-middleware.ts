import { camelCase } from "@lindorm/case";
import { IEntity } from "@lindorm/entity";
import { ClientError } from "@lindorm/errors";
import { Constructor } from "@lindorm/types";
import { get } from "object-path";
import { IRedisSource } from "../interfaces";
import { RedisPylonHttpContext, RedisPylonHttpMiddleware } from "../types";

type Options = {
  key?: string;
  optional?: boolean;
};

export const createHttpRedisEntityMiddleware =
  <C extends RedisPylonHttpContext = RedisPylonHttpContext>(
    Entity: Constructor<IEntity>,
    source?: IRedisSource,
  ) =>
  (path: string, options: Options = {}): RedisPylonHttpMiddleware<C> => {
    return async function httpRedisEntityMiddleware(ctx, next): Promise<void> {
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

      const repository = source
        ? source.repository(Entity, { logger: ctx.logger })
        : ctx.redis.repository(Entity);

      const name = camelCase(Entity.name);

      ctx.entities[name] = await repository.findOneOrFail({ [key]: value });

      await next();
    };
  };
