import { camelCase } from "@lindorm/case";
import { globalEntityMetadata, IEntity } from "@lindorm/entity";
import { ClientError, ServerError } from "@lindorm/errors";
import { isObject, isString } from "@lindorm/is";
import { Constructor, Dict } from "@lindorm/types";
import { get } from "object-path";
import { IRedisSource } from "../interfaces";
import { RedisPylonHttpContext, RedisPylonHttpMiddleware } from "../types";

type Path<E extends Constructor<IEntity>> =
  | { [K in keyof InstanceType<E>]?: string }
  | string;

type Options = {
  key?: string;
  optional?: boolean;
};

export const createHttpRedisEntityMiddleware =
  <
    C extends RedisPylonHttpContext = RedisPylonHttpContext,
    E extends Constructor<IEntity> = Constructor<IEntity>,
  >(
    target: E,
    source?: IRedisSource,
  ) =>
  (path: Path<E>, options: Options = {}): RedisPylonHttpMiddleware<C> => {
    const metadata = globalEntityMetadata.get(target);
    const primaryKey = metadata.columns.find((c) => c.decorator === "PrimaryKeyColumn");

    return async function httpRedisEntityMiddleware(ctx, next): Promise<void> {
      if (!isObject(ctx.entities)) {
        ctx.entities = {};
      }

      const { optional = false } = options;

      if (isString(path) && !primaryKey) {
        throw new ServerError("@PrimaryKeyColumn not set on @Entity", {
          details: "String path cannot be used",
          debug: { path },
        });
      }

      const paths: Dict = isObject(path) ? path : { [primaryKey!.key]: path };
      const filter: Dict = {};

      for (const [key, objectPath] of Object.entries(paths)) {
        filter[key] = get(ctx, objectPath);
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
        ? source.repository(target, { logger: ctx.logger })
        : ctx.sources.redis.repository(target);

      const name = camelCase(target.name);
      const found = await repository.findOne(filter);

      if (found) {
        ctx.entities[name] = found;

        ctx.logger.debug("Redis Entity added to http context", {
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
