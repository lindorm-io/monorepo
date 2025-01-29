import { camelCase } from "@lindorm/case";
import { IEntityBase } from "@lindorm/entity";
import { isObject } from "@lindorm/is";
import { Constructor } from "@lindorm/types";
import { IRedisSource } from "../interfaces";
import { RedisPylonHttpContext, RedisPylonHttpMiddleware } from "../types";

export const createHttpRedisRepositoryMiddleware = <
  C extends RedisPylonHttpContext = RedisPylonHttpContext,
>(
  entities: Array<Constructor<IEntityBase>>,
  source?: IRedisSource,
): RedisPylonHttpMiddleware<C> => {
  return async function httpRedisRepositoryMiddleware(ctx, next): Promise<void> {
    if (!isObject(ctx.repositories)) {
      ctx.repositories = {} as any;
    }

    if (!isObject(ctx.repositories.redis)) {
      ctx.repositories.redis = {} as any;
    }

    for (const Entity of entities) {
      const name = camelCase(Entity.name ?? Entity.constructor.name);
      const key = `${name}Repository`;

      ctx.repositories.redis[key] = source
        ? source.repository(Entity, { logger: ctx.logger })
        : ctx.sources.redis.repository(Entity);
    }

    ctx.logger.debug("Redis Repositories added to http context", {
      repositories: entities.map((e) => e.name ?? e.constructor.name),
    });

    await next();
  };
};
