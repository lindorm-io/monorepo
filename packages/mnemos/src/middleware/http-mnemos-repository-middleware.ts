import { camelCase } from "@lindorm/case";
import { IEntityBase } from "@lindorm/entity";
import { isObject } from "@lindorm/is";
import { Constructor } from "@lindorm/types";
import { IMnemosSource } from "../interfaces";
import { MnemosPylonHttpContext, MnemosPylonHttpMiddleware } from "../types";

export const createHttpMnemosRepositoryMiddleware = <
  C extends MnemosPylonHttpContext = MnemosPylonHttpContext,
>(
  entities: Array<Constructor<IEntityBase>>,
  source?: IMnemosSource,
): MnemosPylonHttpMiddleware<C> => {
  return async function httpMnemosRepositoryMiddleware(ctx, next): Promise<void> {
    if (!isObject(ctx.repositories)) {
      ctx.repositories = {} as any;
    }

    if (!isObject(ctx.repositories.mnemos)) {
      ctx.repositories.mnemos = {} as any;
    }

    for (const Entity of entities) {
      const name = camelCase(Entity.name ?? Entity.constructor.name);
      const key = `${name}Repository`;

      ctx.repositories.mnemos[key] = source
        ? source.repository(Entity, { logger: ctx.logger })
        : ctx.sources.mnemos.repository(Entity);
    }

    ctx.logger.debug("Mnemos Repositories added to http context", {
      repositories: entities.map((e) => e.name ?? e.constructor.name),
    });

    await next();
  };
};
