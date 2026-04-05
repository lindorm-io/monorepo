import { ServerError } from "@lindorm/errors";
import { IHermes } from "@lindorm/hermes";
import { IIrisSource } from "@lindorm/iris";
import { Middleware } from "@lindorm/middleware";
import { IProteusSource } from "@lindorm/proteus";
import { AUDIT_SOURCE, RATE_LIMIT_SOURCE, ROOMS_SOURCE } from "../constants/symbols";
import { PylonCommonContext } from "../../types";

type AuditConfig = {
  iris: IIrisSource;
  actor: (ctx: any) => string;
  sanitise?: (body: unknown) => unknown;
  skip?: (ctx: any) => boolean;
};

type Options = {
  auditConfig?: AuditConfig;
  hermes?: IHermes;
  iris?: IIrisSource;
  proteus?: IProteusSource;
  rateLimitProteus?: IProteusSource;
  roomsProteus?: IProteusSource;
};

export const createSourcesMiddleware = <C extends PylonCommonContext>(
  options: Options,
): Middleware<C> => {
  return async function sourcesMiddleware(ctx, next) {
    const timer = ctx.logger.time();

    try {
      ctx.hermes = options.hermes?.clone({ logger: ctx.logger });

      if (options.proteus) {
        ctx.proteus = options.proteus.clone({ logger: ctx.logger, context: ctx });
        ctx.logger.debug("ProteusSource added to context");
      }

      if (options.iris) {
        ctx.iris = options.iris.clone({ logger: ctx.logger, context: ctx });
        ctx.logger.debug("IrisSource added to context");
      }

      if (options.auditConfig) {
        (ctx as any)[AUDIT_SOURCE] = options.auditConfig;
      }

      if (options.rateLimitProteus) {
        (ctx as any)[RATE_LIMIT_SOURCE] = options.rateLimitProteus;
      }

      if (options.roomsProteus) {
        (ctx as any)[ROOMS_SOURCE] = options.roomsProteus;
      }

      timer.debug("Sources added to context");
    } catch (error: any) {
      timer.debug("Failed to add sources to context");

      throw new ServerError("Failed to add sources to context", { error });
    }

    await next();
  };
};
