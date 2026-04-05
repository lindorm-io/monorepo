import { resolveProteus } from "#internal/utils/resolve-proteus";
import { camelCase } from "@lindorm/case";
import { IEntity, IProteusSource } from "@lindorm/proteus";
import { Constructor, Dict } from "@lindorm/types";
import { lazyFactory } from "@lindorm/utils";
import { PylonContext, PylonMiddleware } from "../../types";

export const createCacheMiddleware = <C extends PylonContext = PylonContext>(
  entities: Array<Constructor<IEntity>>,
  proteus?: IProteusSource,
): PylonMiddleware<C> =>
  async function cacheMiddleware(ctx, next) {
    const source = resolveProteus(ctx, proteus);
    const obj: Dict = {};

    for (const entity of entities) {
      lazyFactory(obj, camelCase(entity.name), () => source.repository(entity));
    }

    ctx.caches = obj;

    await next();
  };
