import { camelCase } from "@lindorm/case";
import { ClientError } from "@lindorm/errors";
import { isObject } from "@lindorm/is";
import { Constructor, Dict } from "@lindorm/types";
import { get } from "object-path";
import { IElasticEntity, IElasticSource } from "../interfaces";
import { ElasticPylonHttpContext, ElasticPylonHttpMiddleware } from "../types";

type Path<E extends Constructor<IElasticEntity>> =
  | { [K in keyof InstanceType<E>]?: string }
  | string;

type Options = {
  optional?: boolean;
};

export const createHttpElasticEntityMiddleware =
  <
    C extends ElasticPylonHttpContext = ElasticPylonHttpContext,
    E extends Constructor<IElasticEntity> = Constructor<IElasticEntity>,
  >(
    Entity: E,
    source?: IElasticSource,
  ) =>
  (path: Path<E>, options: Options = {}): ElasticPylonHttpMiddleware<C> => {
    return async function httpElasticEntityMiddleware(ctx, next): Promise<void> {
      const { optional = false } = options;

      const paths: Dict<any> = isObject(path) ? path : { id: path };
      const filter: Dict<any> = {};

      for (const [key, objectPath] of Object.entries(paths)) {
        filter[key] = get(ctx, objectPath);
      }

      if (!isObject(ctx.entities)) {
        ctx.entities = {};
      }

      const hasValues = Object.values(filter).every(Boolean);

      if (!hasValues && optional) {
        return await next();
      }

      if (!hasValues) {
        throw new ClientError("Invalid value for repository query", {
          debug: { path, keys: paths, filter },
        });
      }

      const repository = source
        ? source.repository(Entity, { logger: ctx.logger })
        : ctx.sources.elastic.repository(Entity);

      const name = camelCase(Entity.name);
      const found = await repository.findOne({
        must: Object.entries(filter).map(([k, v]) => ({
          term: { [k]: v },
        })),
      });

      if (found) {
        ctx.entities[name] = found;

        ctx.logger.debug("Elastic Entity added to http context", {
          name,
          path,
          keys: paths,
          filter,
        });
      } else if (!optional) {
        throw new ClientError("Entity not found", {
          debug: { name, path, keys: paths, filter },
          status: ClientError.Status.NotFound,
        });
      }

      await next();
    };
  };
