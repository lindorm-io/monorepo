import { camelCase } from "@lindorm/case";
import { IEntity } from "@lindorm/entity";
import { ClientError } from "@lindorm/errors";
import { Constructor } from "@lindorm/types";
import { get } from "object-path";
import { IMnemosSource } from "../interfaces";
import { MnemosPylonHttpContext, MnemosPylonHttpMiddleware } from "../types";

type Options = {
  key?: string;
  optional?: boolean;
};

export const createHttpMnemosEntityMiddleware =
  <C extends MnemosPylonHttpContext = MnemosPylonHttpContext>(
    Entity: Constructor<IEntity>,
    source?: IMnemosSource,
  ) =>
  (path: string, options: Options = {}): MnemosPylonHttpMiddleware<C> => {
    return async function httpMnemosEntityMiddleware(ctx, next): Promise<void> {
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
        : ctx.sources.mnemos.repository(Entity);

      const name = camelCase(Entity.name);

      ctx.entities[name] = repository.findOneOrFail({ [key]: value });

      await next();
    };
  };
