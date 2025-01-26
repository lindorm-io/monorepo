import { camelCase } from "@lindorm/case";
import { isObject } from "@lindorm/is";
import { Constructor } from "@lindorm/types";
import { IRedisEntity, IRedisSource } from "../interfaces";
import { RedisPylonSocketContext, RedisPylonSocketMiddleware } from "../types";

export const createSocketRedisRepositoryMiddleware = <
  C extends RedisPylonSocketContext = RedisPylonSocketContext,
>(
  entities: Array<Constructor<IRedisEntity>>,
  source?: IRedisSource,
): RedisPylonSocketMiddleware<C> => {
  return async function socketRedisRepositoryMiddleware(ctx, next): Promise<void> {
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

    ctx.logger.debug("Redis Repositories added to event context", {
      repositories: entities.map((e) => e.name ?? e.constructor.name),
    });

    await next();
  };
};
