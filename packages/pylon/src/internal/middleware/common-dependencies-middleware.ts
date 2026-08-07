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
import { AUDIT_SOURCE, AUTH_CACHE_POLICY } from "../constants/symbols.js";
import {
  createAuthClient,
  createSocketClaimsClient,
} from "../utils/auth/create-auth-client.js";
import { createUnconfiguredAuthClient } from "../utils/auth/create-unconfigured-auth-client.js";
import {
  buildIrisSessionOptions,
  buildProteusSessionOptions,
} from "../utils/build-session-options.js";
import { isHttpContext } from "../utils/is-context.js";
import {
  createHttpRoomContext,
  createRoomContext,
} from "../utils/create-room-context.js";
import {
  createHttpSocketEmitter,
  createSocketEmitter,
} from "../utils/create-socket-emitter.js";
import { resolveActor, type ActorResolver } from "../utils/resolve-actor.js";

type AuditConfig = {
  bus: IIrisSource;
  sanitise?: (body: unknown) => unknown;
  skip?: (ctx: any) => boolean;
};

/**
 * Sources come in under their ROLE — `db` / `kv` / `cache` / `bus` — and each
 * one becomes a per-request `ctx.*` session. There is no second, per-feature
 * channel: a feature that needs storage picks the role whose eviction policy it
 * can live with (`ctx.cache` for a rate-limit bucket or a cached response,
 * `ctx.kv` for a session or a presence record) and reads it off the context.
 *
 * The remaining fields are POLICY, not storage — the wiring a feature cannot
 * derive from the context on its own.
 */
type Options = {
  actor?: ActorResolver;
  authConfig?: PylonAuthConfig;
  auditConfig?: AuditConfig;
  hermes?: IHermes;
  bus?: IIrisSource;
  cache?: IProteusSource;
  kv?: IProteusSource;
  db?: IProteusSource;
  roomsEnabled?: boolean;
  roomsPresence?: boolean;
};

export const createDependenciesMiddleware = <C extends PylonCommonContext>(
  options: Options,
): Middleware<C> => {
  return async function dependenciesMiddleware(ctx, next) {
    const timer = ctx.logger.timer();

    try {
      // Resolve actor once per request from the top-level resolver (or the
      // default fallback). Downstream hooks receive this via
      // ProteusHookMeta/IrisHookMeta instead of spelunking into Koa ctx per
      // event. The result is memoised on ctx.state.actor.
      const actor: string = resolveActor(ctx, options.actor);

      if (options.hermes) {
        lazyFactory(ctx, "hermes", () => options.hermes!.session({ logger: ctx.logger }));
      }

      if (options.db) {
        lazyFactory(ctx, "db", () =>
          options.db!.session(buildProteusSessionOptions(ctx, actor)),
        );
      }

      if (options.kv) {
        lazyFactory(ctx, "kv", () =>
          options.kv!.session(buildProteusSessionOptions(ctx, actor)),
        );
      }

      // Installed the same way as `kv` — a lazyFactory GETTER, so a request that
      // never caches anything never opens a session against the evictable store.
      if (options.cache) {
        lazyFactory(ctx, "cache", () =>
          options.cache!.session(buildProteusSessionOptions(ctx, actor)),
        );
      }

      if (options.bus) {
        lazyFactory(ctx, "bus", () =>
          options.bus!.session(buildIrisSessionOptions(ctx, actor)),
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

      // The driver-response cache POLICY — the entries themselves live in
      // `ctx.cache`. Present ONLY when the deployment configured `auth.cache`,
      // and `parseAuthConfig` is the one place that decides so: its absence is
      // what keeps caching off, with no second flag free to disagree.
      if (options.authConfig?.cache) {
        (ctx as any)[AUTH_CACHE_POLICY] = options.authConfig.cache;
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

      // Rooms (only when rooms enabled). `ctx.kv` is read INSIDE the lazy
      // factory, so a request that never touches `ctx.rooms` never opens a kv
      // session — and presence lands in the authoritative store, never in
      // `cache`, because an evicted record drops a live member.
      if (options.roomsEnabled && "io" in ctx && "event" in ctx) {
        lazyFactory(ctx, "rooms", () =>
          createRoomContext({
            socket: (ctx as any).io.socket,
            io: (ctx as any).io.app,
            logger: ctx.logger,
            session: options.roomsPresence ? ctx.kv : undefined,
          }),
        );
      } else if (options.roomsEnabled && "io" in ctx && "request" in ctx) {
        lazyFactory(ctx, "rooms", () =>
          createHttpRoomContext({
            io: (ctx as any).io.app,
            logger: ctx.logger,
            session: options.roomsPresence ? ctx.kv : undefined,
          }),
        );
      }

      timer.debug("Dependencies added to context");
    } catch (error: any) {
      timer.debug("Failed to add dependencies to context");

      throw new ServerError("Failed to add dependencies to request context", {
        code: "dependency_resolution_failed",
        title: "Dependency Resolution Failed",
        type: "urn:lindorm:pylon:error:dependency_resolution_failed",
        details:
          "One of the per-request dependencies (actor, hermes, db, kv, cache, bus, auth, socket, or rooms) could not be resolved",
        debug: { error },
      });
    }

    await next();
  };
};
