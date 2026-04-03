import { ServerError } from "@lindorm/errors";
import { IHermes } from "@lindorm/hermes";
import { IIrisSource } from "@lindorm/iris";
import { Middleware } from "@lindorm/middleware";
import { IProteusSource } from "@lindorm/proteus";
import { PylonCommonContext } from "../../types";

type Options = {
  hermes?: IHermes;
  iris?: IIrisSource;
  proteus?: IProteusSource;
};

export const createSourcesMiddleware = <C extends PylonCommonContext>(
  options: Options,
): Middleware<C> => {
  return async function sourcesMiddleware(ctx, next) {
    const timer = ctx.logger.time();

    try {
      ctx.hermes = options.hermes?.clone({ logger: ctx.logger });

      if (options.proteus) {
        ctx.proteus = options.proteus.clone({ logger: ctx.logger });
        ctx.logger.debug("ProteusSource added to context");
      }

      if (options.iris) {
        ctx.iris = options.iris.clone({ logger: ctx.logger });
        ctx.logger.debug("IrisSource added to context");
      }

      timer.debug("Sources added to context");
    } catch (error: any) {
      timer.debug("Failed to add sources to context");

      throw new ServerError("Failed to add sources to context", { error });
    }

    await next();
  };
};
