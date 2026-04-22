import { ServerError } from "@lindorm/errors";
import type { IHermes } from "@lindorm/hermes";
import type { IIrisSource } from "@lindorm/iris";
import type { Middleware } from "@lindorm/middleware";
import type { IProteusSource } from "@lindorm/proteus";
import { lazyFactory } from "@lindorm/utils";
import type {
  PylonAuthConfig,
  PylonCommonContext,
  PylonContext,
  PylonHttpContext,
} from "../../types/index.js";
import { AUDIT_SOURCE, RATE_LIMIT_SOURCE } from "../constants/symbols.js";
import {
  createAuthClient,
  createSocketClaimsClient,
} from "../utils/auth/create-auth-client.js";
import { createUnconfiguredAuthClient } from "../utils/auth/create-unconfigured-auth-client.js";
import { isHttpContext } from "../utils/is-context.js";
import {
  createHttpRoomContext,
  createRoomContext,
} from "../utils/create-room-context.js";
import {
  createHttpSocketEmitter,
  createSocketEmitter,
} from "../utils/create-socket-emitter.js";

type AuditConfig = {
  iris: IIrisSource;
  actor: (ctx: any) => string;
  sanitise?: (body: unknown) => unknown;
  skip?: (ctx: any) => boolean;
};

type Options = {
  authConfig?: PylonAuthConfig;
  auditConfig?: AuditConfig;
  hermes?: IHermes;
  iris?: IIrisSource;
  proteus?: IProteusSource;
  rateLimitProteus?: IProteusSource;
  roomsEnabled?: boolean;
  roomsPresence?: boolean;
  roomsProteus?: IProteusSource;
};

export const createDependenciesMiddleware = <C extends PylonCommonContext>(
  options: Options,
): Middleware<C> => {
  return async function dependenciesMiddleware(ctx, next) {
    const timer = ctx.logger.time();

    try {
      if (options.hermes) {
        lazyFactory(ctx, "hermes", () => options.hermes!.session({ logger: ctx.logger }));
      }

      if (options.proteus) {
        lazyFactory(ctx, "proteus", () =>
          options.proteus!.session({
            logger: ctx.logger,
            context: ctx,
            signal: isHttpContext(ctx) ? (ctx as PylonHttpContext).signal : undefined,
          }),
        );
      }

      if (options.iris) {
        lazyFactory(ctx, "iris", () =>
          options.iris!.session({ logger: ctx.logger, context: ctx }),
        );
      }

      if (options.authConfig) {
        if (isHttpContext(ctx)) {
          lazyFactory(ctx, "auth", () =>
            createAuthClient(ctx as unknown as PylonHttpContext, options.authConfig!),
          );
        } else {
          lazyFactory(ctx, "auth", () =>
            createSocketClaimsClient(ctx as unknown as PylonContext, options.authConfig!),
          );
        }
      } else {
        lazyFactory(ctx, "auth", () => createUnconfiguredAuthClient());
      }

      if (options.auditConfig) {
        (ctx as any)[AUDIT_SOURCE] = options.auditConfig;
      }

      if (options.rateLimitProteus) {
        (ctx as any)[RATE_LIMIT_SOURCE] = options.rateLimitProteus;
      }

      // Socket emitter (available whenever io is present)
      if ("io" in ctx && "event" in ctx) {
        // Socket context
        lazyFactory(ctx, "socket", () =>
          createSocketEmitter({
            io: (ctx as any).io.app,
            socket: (ctx as any).io.socket,
            correlationId: (ctx as any).state?.metadata?.correlationId ?? "unknown",
          }),
        );
      } else if ("io" in ctx && "request" in ctx) {
        // HTTP context
        lazyFactory(ctx, "socket", () =>
          createHttpSocketEmitter({
            io: (ctx as any).io.app,
            correlationId: (ctx as any).state?.metadata?.correlationId ?? "unknown",
          }),
        );
      }

      // Rooms (only when rooms enabled)
      if (options.roomsEnabled && "io" in ctx && "event" in ctx) {
        lazyFactory(ctx, "rooms", () =>
          createRoomContext({
            socket: (ctx as any).io.socket,
            io: (ctx as any).io.app,
            logger: ctx.logger,
            proteusSource: options.roomsProteus,
            presence: options.roomsPresence,
          }),
        );
      } else if (options.roomsEnabled && "io" in ctx && "request" in ctx) {
        lazyFactory(ctx, "rooms", () =>
          createHttpRoomContext({
            io: (ctx as any).io.app,
            logger: ctx.logger,
            proteusSource: options.roomsProteus,
            presence: options.roomsPresence,
          }),
        );
      }

      timer.debug("Dependencies added to context");
    } catch (error: any) {
      timer.debug("Failed to add dependencies to context");

      throw new ServerError("Failed to add dependencies to context", { error });
    }

    await next();
  };
};
