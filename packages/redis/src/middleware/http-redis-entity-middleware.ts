import { camelCase } from "@lindorm/case";
import { ClientError } from "@lindorm/errors";
import { Constructor } from "@lindorm/types";
import { get } from "object-path";
import { IRedisEntity } from "../interfaces";
import { RedisPylonHttpContext, RedisPylonHttpMiddleware } from "../types";

type Options = {
  key?: string;
  optional?: boolean;
};

export const createHttpRedisEntityMiddleware =
  <C extends RedisPylonHttpContext = RedisPylonHttpContext>(
    Entity: Constructor<IRedisEntity>,
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

      const repository = ctx.redis.repository(Entity);
      const name = camelCase(Entity.name);

      ctx.entities[name] = await repository.findOneOrFail({ [key]: value });

      await next();
    };
  };
