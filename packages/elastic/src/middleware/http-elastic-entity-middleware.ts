import { camelCase } from "@lindorm/case";
import { ClientError } from "@lindorm/errors";
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

      if (!value && optional) {
        return await next();
      }

      if (!value) {
        throw new ClientError("Invalid value for repository query", {
          debug: { path, key, value },
        });
      }

      if (!ctx.entities) {
        ctx.entities = {};
      }

      const repository = source
        ? source.repository(Entity, { logger: ctx.logger })
        : ctx.elastic.repository(Entity);

      const name = camelCase(Entity.name);

      ctx.entities[name] = await repository.findOneOrFail({ [key]: value });

      await next();
    };
  };
