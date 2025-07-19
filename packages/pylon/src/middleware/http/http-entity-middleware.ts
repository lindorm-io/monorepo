import { camelCase } from "@lindorm/case";
import { IEntity } from "@lindorm/entity";
import { ClientError } from "@lindorm/errors";
import { Middleware } from "@lindorm/middleware";
import { Constructor } from "@lindorm/types";
import { PylonCommonContext, PylonEntitySourceName, SearchPath } from "../../types";
import { findEntity } from "../../utils/private";

type Options = {
  mandatory?: boolean;
};

export const createHttpEntityMiddleware =
  <E extends Constructor<IEntity>>(target: E, source?: PylonEntitySourceName) =>
  (path: SearchPath<E>, options: Options = {}): Middleware<PylonCommonContext> => {
    const mandatory = options.mandatory ?? true;

    return async function httpEntityMiddleware(ctx, next): Promise<void> {
      const opts = {
        mandatory,
        name: camelCase(target.name),
        path,
        source,
      };

      const found = await findEntity(ctx, target, opts);

      if (found) {
        ctx.entities[opts.name] = found;

        ctx.logger.debug("Entity added to context", opts);
      } else if (mandatory) {
        throw new ClientError("Entity not found", {
          debug: opts,
          status: ClientError.Status.NotFound,
        });
      }

      await next();
    };
  };
