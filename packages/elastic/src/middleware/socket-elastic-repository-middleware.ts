import { camelCase } from "@lindorm/case";
import { isObject } from "@lindorm/is";
import { Constructor } from "@lindorm/types";
import { IElasticEntity, IElasticSource } from "../interfaces";
import { ElasticPylonSocketContext, ElasticPylonSocketMiddleware } from "../types";

export const createSocketElasticRepositoryMiddleware = <
  C extends ElasticPylonSocketContext = ElasticPylonSocketContext,
>(
  entities: Array<Constructor<IElasticEntity>>,
  source?: IElasticSource,
): ElasticPylonSocketMiddleware<C> => {
  return async function socketElasticRepositoryMiddleware(ctx, next): Promise<void> {
    if (!isObject(ctx.repositories)) {
      ctx.repositories = {} as any;
    }

    if (!isObject(ctx.repositories.elastic)) {
      ctx.repositories.elastic = {} as any;
    }

    for (const Entity of entities) {
      const name = camelCase(Entity.name ?? Entity.constructor.name);
      const key = `${name}Repository`;

      ctx.repositories.elastic[key] = source
        ? source.repository(Entity, { logger: ctx.logger })
        : ctx.sources.elastic.repository(Entity);
    }

    ctx.logger.debug("Elastic Repositories added to event context", {
      repositories: entities.map((e) => e.name ?? e.constructor.name),
    });

    await next();
  };
};
