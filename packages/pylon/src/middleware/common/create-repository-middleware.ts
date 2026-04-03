import { resolveProteus } from "#internal/utils/resolve-proteus";
import { camelCase } from "@lindorm/case";
import { IEntity, IProteusSource } from "@lindorm/proteus";
import { Constructor, Dict } from "@lindorm/types";
import { PylonContext, PylonMiddleware } from "../../types";

export const createRepositoryMiddleware = <C extends PylonContext = PylonContext>(
  entities: Array<Constructor<IEntity>>,
  proteus?: IProteusSource,
): PylonMiddleware<C> =>
  async function repositoryMiddleware(ctx, next) {
    const source = resolveProteus(ctx, proteus);
    const obj: Dict = {};

    for (const entity of entities) {
      let cached: any;
      Object.defineProperty(obj, camelCase(entity.name), {
        get: () => (cached ??= source.repository(entity)),
        enumerable: true,
        configurable: true,
      });
    }

    ctx.repositories = obj;

    await next();
  };
