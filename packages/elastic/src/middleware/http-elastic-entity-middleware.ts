import { camelCase } from "@lindorm/case";
import { ClientError } from "@lindorm/errors";
import { isObject } from "@lindorm/is";
import { Constructor } from "@lindorm/types";
import { get } from "object-path";
import { IElasticEntity, IElasticSource } from "../interfaces";
import { ElasticPylonHttpContext, ElasticPylonHttpMiddleware } from "../types";

type Options = {
  key?: string;
  optional?: boolean;
};

export const createHttpElasticEntityMiddleware =
  <C extends ElasticPylonHttpContext = ElasticPylonHttpContext>(
    Entity: Constructor<IElasticEntity>,
    source?: IElasticSource,
  ) =>
  (path: string, options: Options = {}): ElasticPylonHttpMiddleware<C> => {
    return async function httpElasticEntityMiddleware(ctx, next): Promise<void> {
      const { key = "id", optional = false } = options;
      const value = get(ctx, path);

      if (!isObject(ctx.entities)) {
        ctx.entities = {};
      }

      if (!value && optional) {
        return await next();
      }

      if (!value) {
        throw new ClientError("Invalid value for repository query", {
          debug: { path, key, value },
        });
      }

      const repository = source
        ? source.repository(Entity, { logger: ctx.logger })
        : ctx.sources.elastic.repository(Entity);

      const name = camelCase(Entity.name);
      const found = await repository.findOne({ [key]: value });

      if (found) {
        ctx.entities[name] = found;

        ctx.logger.debug("Elastic Entity added to http context", {
          name,
          key,
          value,
        });
      } else if (!optional) {
        throw new ClientError("Entity not found", {
          debug: { key, value, name },
          status: ClientError.Status.NotFound,
        });
      }

      await next();
    };
  };
