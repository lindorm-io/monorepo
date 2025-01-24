import { camelCase } from "@lindorm/case";
import { IEntity } from "@lindorm/entity";
import { isObject } from "@lindorm/is";
import { Constructor } from "@lindorm/types";
import { IMongoSource } from "../interfaces";
import { MongoPylonSocketContext, MongoPylonSocketMiddleware } from "../types";

export const createSocketMongoRepositoryMiddleware = <
  C extends MongoPylonSocketContext = MongoPylonSocketContext,
>(
  entities: Array<Constructor<IEntity>>,
  source?: IMongoSource,
): MongoPylonSocketMiddleware<C> => {
  return async function socketMongoRepositoryMiddleware(ctx, next): Promise<void> {
    if (!isObject(ctx.repositories)) {
      ctx.repositories = {} as any;
    }

    if (!isObject(ctx.repositories.mongo)) {
      ctx.repositories.mongo = {} as any;
    }

    for (const Entity of entities) {
      const name = camelCase(Entity.name ?? Entity.constructor.name);
      const key = `${name}Repository`;

      ctx.repositories.mongo[key] = source
        ? source.repository(Entity, { logger: ctx.logger })
        : ctx.sources.mongo.repository(Entity);
    }

    ctx.logger.debug("Mongo Repositories added to event context", {
      repositories: entities.map((e) => e.name ?? e.constructor.name),
    });

    await next();
  };
};
