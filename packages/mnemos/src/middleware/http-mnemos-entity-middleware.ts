import { camelCase } from "@lindorm/case";
import { IEntity } from "@lindorm/entity";
import { ClientError } from "@lindorm/errors";
import { isObject } from "@lindorm/is";
import { Constructor, Dict } from "@lindorm/types";
import { get } from "object-path";
import { IMnemosSource } from "../interfaces";
import { MnemosPylonHttpContext, MnemosPylonHttpMiddleware } from "../types";

type Path<E extends Constructor<IEntity>> =
  | { [K in keyof InstanceType<E>]?: string }
  | string;

type Options = {
  key?: string;
  optional?: boolean;
};

export const createHttpMnemosEntityMiddleware =
  <
    C extends MnemosPylonHttpContext = MnemosPylonHttpContext,
    E extends Constructor<IEntity> = Constructor<IEntity>,
  >(
    Entity: E,
    source?: IMnemosSource,
  ) =>
  (path: Path<E>, options: Options = {}): MnemosPylonHttpMiddleware<C> => {
    return async function httpMnemosEntityMiddleware(ctx, next): Promise<void> {
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
          debug: { path, paths, filter },
        });
      }

      const repository = source
        ? source.repository(Entity, { logger: ctx.logger })
        : ctx.sources.mnemos.repository(Entity);

      const name = camelCase(Entity.name);
      const found = repository.findOne(filter);

      if (found) {
        ctx.entities[name] = found;

        ctx.logger.debug("Mnemos Entity added to http context", {
          name,
          path,
          paths,
          filter,
        });
      } else if (!optional) {
        throw new ClientError("Entity not found", {
          debug: { name, path, paths, filter },
          status: ClientError.Status.NotFound,
        });
      }

      await next();
    };
  };
