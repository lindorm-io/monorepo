import { camelCase } from "@lindorm/case";
import { ClientError } from "@lindorm/errors";
import { Constructor } from "@lindorm/types";
import { get } from "object-path";
import { IElasticEntity, IElasticSource } from "../interfaces";
import { ElasticPylonEventContext, ElasticPylonEventMiddleware } from "../types";

type Options = {
  key?: string;
  optional?: boolean;
};

export const createSocketElasticEntityMiddleware =
  <C extends ElasticPylonEventContext = ElasticPylonEventContext>(
    Entity: Constructor<IElasticEntity>,
    source?: IElasticSource,
  ) =>
  (path: string, options: Options = {}): ElasticPylonEventMiddleware<C> => {
    return async function socketElasticEntityMiddleware(ctx, next): Promise<void> {
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
        : ctx.sources.elastic.repository(Entity);

      const name = camelCase(Entity.name);

      ctx.entities[name] = await repository.findOneOrFail({ [key]: value });

      await next();
    };
  };
