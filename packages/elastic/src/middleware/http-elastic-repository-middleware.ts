import { camelCase } from "@lindorm/case";
import { IEntityBase } from "@lindorm/entity";
import { isObject } from "@lindorm/is";
import { Constructor } from "@lindorm/types";
import { IElasticSource } from "../interfaces";
import { ElasticPylonHttpContext, ElasticPylonHttpMiddleware } from "../types";

export const createHttpElasticRepositoryMiddleware = <
  C extends ElasticPylonHttpContext = ElasticPylonHttpContext,
>(
  entities: Array<Constructor<IEntityBase>>,
  source?: IElasticSource,
): ElasticPylonHttpMiddleware<C> => {
  return async function httpElasticRepositoryMiddleware(ctx, next): Promise<void> {
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

    ctx.logger.debug("Elastic Repositories added to http context", {
      repositories: entities.map((e) => e.name ?? e.constructor.name),
    });

    await next();
  };
};
