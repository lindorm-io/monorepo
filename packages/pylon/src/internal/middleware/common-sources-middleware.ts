import { ServerError } from "@lindorm/errors";
import { IHermes } from "@lindorm/hermes";
import { IIrisSource } from "@lindorm/iris";
import { Middleware } from "@lindorm/middleware";
import { IProteusSource } from "@lindorm/proteus";
import { lazyFactory } from "@lindorm/utils";
import { AUDIT_SOURCE, RATE_LIMIT_SOURCE } from "../constants/symbols";
import { createRoomContext } from "../utils/create-room-context";
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
  roomsEnabled?: boolean;
  roomsPresence?: boolean;
  roomsProteus?: IProteusSource;
};

export const createSourcesMiddleware = <C extends PylonCommonContext>(
  options: Options,
): Middleware<C> => {
  return async function sourcesMiddleware(ctx, next) {
    const timer = ctx.logger.time();

    try {
      if (options.hermes) {
        lazyFactory(ctx, "hermes", () => options.hermes!.session({ logger: ctx.logger }));
      }

      if (options.proteus) {
        lazyFactory(ctx, "proteus", () =>
          options.proteus!.session({ logger: ctx.logger, context: ctx }),
        );
      }

      if (options.iris) {
        lazyFactory(ctx, "iris", () =>
          options.iris!.session({ logger: ctx.logger, context: ctx }),
        );
      }

      if (options.auditConfig) {
        (ctx as any)[AUDIT_SOURCE] = options.auditConfig;
      }

      if (options.rateLimitProteus) {
        (ctx as any)[RATE_LIMIT_SOURCE] = options.rateLimitProteus;
      }

      if (options.roomsEnabled && "socket" in ctx && "io" in ctx) {
        lazyFactory(ctx, "rooms", () =>
          createRoomContext({
            socket: (ctx as any).socket,
            io: (ctx as any).io,
            logger: ctx.logger,
            proteusSource: options.roomsProteus,
            presence: options.roomsPresence,
          }),
        );
      }

      timer.debug("Sources added to context");
    } catch (error: any) {
      timer.debug("Failed to add sources to context");

      throw new ServerError("Failed to add sources to context", { error });
    }

    await next();
  };
};
