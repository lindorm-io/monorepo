import { PylonRouterScanner } from "../internal/classes/PylonRouterScanner.js";
import { createCommonContextInitialisationMiddleware } from "../internal/middleware/common-context-initialisation-middleware.js";
import { createQueueMiddleware } from "../internal/middleware/common-queue-middleware.js";
import { createDependenciesMiddleware } from "../internal/middleware/common-dependencies-middleware.js";
import { createWebhookMiddleware } from "../internal/middleware/common-webhook-middleware.js";
import { createHttpAbortSignalMiddleware } from "../internal/middleware/http-abort-signal-middleware.js";
import { createHttpBodyParserMiddleware } from "../internal/middleware/http-body-parser-middleware.js";
import { httpChallengeMiddleware } from "../internal/middleware/http-challenge-middleware.js";
import { createHttpContextInitialisationMiddleware } from "../internal/middleware/http-context-initialisation-middleware.js";
import { createHttpCookiesMiddleware } from "../internal/middleware/http-cookies-middleware.js";
import { createHttpCorsMiddleware } from "../internal/middleware/http-cors-middleware.js";
import { createHttpDateValidationMiddleware } from "../internal/middleware/http-date-validation-middleware.js";
import { httpErrorHandlerMiddleware } from "../internal/middleware/http-error-handler-middleware.js";
import { httpQueryParserMiddleware } from "../internal/middleware/http-query-parser-middleware.js";
import { httpRequestLoggerMiddleware } from "../internal/middleware/http-request-logger-middleware.js";
import { httpResponseBodyMiddleware } from "../internal/middleware/http-response-body-middleware.js";
import { httpResponseLoggerMiddleware } from "../internal/middleware/http-response-logger-middleware.js";
import { httpResponseTimeMiddleware } from "../internal/middleware/http-response-time-middleware.js";
import { createHttpSessionMiddleware } from "../internal/middleware/http-session-middleware.js";
import { createHttpStateMiddleware } from "../internal/middleware/http-state-middleware.js";
import { parseAuthConfig } from "../internal/utils/auth/parse-auth-config.js";
import { buildAppConfig } from "../internal/utils/build-app-config.js";
import {
  buildLivenessCallback,
  buildReadinessCallback,
} from "../internal/utils/build-health-callbacks.js";
import { createAuthRouter } from "../internal/utils/create-auth-router.js";
import { createHealthRouter } from "../internal/utils/create-health-router.js";
import { createWellKnownRouter } from "../internal/utils/create-well-known-router.js";
import { normaliseRoutes } from "../internal/utils/normalise-routes.js";
import { isString } from "@lindorm/is";
import type { ILogger } from "@lindorm/logger";
import type { IProteusSource } from "@lindorm/proteus";
import Koa from "koa";
import type {
  AppConfig,
  HttpCallback,
  PylonAuthConfig,
  PylonHttpCallback,
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonHttpSettings,
} from "../types/index.js";
import { PylonRouter } from "./PylonRouter.js";

export class PylonHttp<T extends PylonHttpContext = PylonHttpContext> {
  private readonly authConfig: PylonAuthConfig | undefined;
  private readonly logger: ILogger;
  private readonly middleware: Array<PylonHttpMiddleware<T>>;
  private readonly options: PylonHttpSettings<T>;
  private readonly router: PylonRouter<T>;

  private _callback: HttpCallback | undefined;

  readonly server: Koa;

  /**
   * ⚠ `authConfig` is handed in by `Pylon`, which parses it ONCE and gives the
   * SAME object to both transports — a pylon serving http and sockets has one
   * auth configuration, not two equal-but-distinct ones. It falls back to
   * parsing its own only for a `PylonHttp` driven standalone, where there is no
   * second transport to agree with.
   */
  constructor(options: PylonHttpSettings<T>, authConfig?: PylonAuthConfig) {
    this.logger = options.logger.child(["PylonHttp"]);

    this.authConfig =
      authConfig ?? (options.auth ? parseAuthConfig(options.auth) : undefined);
    this.middleware = [];
    this.options = options;
    this.router = new PylonRouter<T>();
    this.server = new Koa({ proxy: options.proxy ?? true });
  }

  // public

  get callback(): HttpCallback {
    if (this._callback) return this._callback;

    this._callback = this.server.callback();

    return this._callback;
  }

  use(middleware: Array<PylonHttpMiddleware<T>>): void {
    this.addMiddleware(middleware);
  }

  /**
   * ⚠ `appConfig` is handed in by `Pylon`, which builds it ONCE after
   * `amphora.setup()` and gives the SAME frozen object to both transports. It
   * falls back to building its own only for a `PylonHttp` driven standalone,
   * where there is no second transport to agree with.
   */
  loadMiddleware(appConfig?: AppConfig): void {
    this.logger.debug("Loading middleware");

    this.server.use(createHttpCorsMiddleware(this.options.cors, this.logger));

    // middleware

    this.addMiddleware([
      httpResponseTimeMiddleware,
      httpResponseLoggerMiddleware,
      httpErrorHandlerMiddleware,
      createHttpStateMiddleware({
        config: appConfig ?? buildAppConfig(this.options),
        environment: this.options.environment,
        name: this.options.name,
        version: this.options.version,
      }),
      httpChallengeMiddleware,
      createHttpContextInitialisationMiddleware(this.logger),
      createHttpAbortSignalMiddleware(),
      createCommonContextInitialisationMiddleware(this.options.amphora),
      createHttpDateValidationMiddleware({
        minRequestAge: this.options.minRequestAge,
        maxRequestAge: this.options.maxRequestAge,
      }),
      createHttpCookiesMiddleware(this.options.cookies),
      ...(this.options.auth?.session
        ? [
            createHttpSessionMiddleware(
              this.options.kv,
              this.options.auth.session,
              this.options.cookies,
            ),
          ]
        : []),
      createHttpBodyParserMiddleware(this.options.parseBody),
      httpQueryParserMiddleware,
      httpRequestLoggerMiddleware,
      httpResponseBodyMiddleware,
      createDependenciesMiddleware({
        actor: this.options.actor,
        authConfig: this.authConfig,
        hermes: this.options.hermes,
        bus: this.options.bus,
        // `ctx.cache` is installed whenever an evictable source is provided,
        // INDEPENDENT of any feature block — `useCache` needs nothing else from
        // the deployment, and `useRateLimit` reads its policy off
        // `ctx.state.app.config`. Both throw only when they run with no session
        // to store in.
        cache: this.cache,
        kv: this.options.kv,
        db: this.options.db,
      }),
      createQueueMiddleware(this.options.queue),
      createWebhookMiddleware(this.options.webhook),
      // ⚠ No global `useRateLimit()` is injected here. Pylon never puts
      // middleware into a deployment's chain because a setting was truthy —
      // mounting IS the declaration. A deployment that wants every route limited
      // mounts `useRateLimit()` itself in the routes' root `_middleware.ts`.
    ]);

    this.logger.debug("Middleware loaded");
  }

  async loadRouters(): Promise<void> {
    this.logger.debug("Loading routers");

    this.router.use(...this.middleware);

    this.addRouter("/health", createHealthRouter(this.resolveHealthCallback()));
    this.addRouter("/ready", createHealthRouter(this.resolveReadyCallback()));
    this.addRouter("/.well-known", createWellKnownRouter(this.options));

    if (this.authConfig?.router) {
      this.addRouter(
        this.authConfig.router.pathPrefix,
        createAuthRouter(this.authConfig),
      );
    }

    const routes = normaliseRoutes(this.options.routes);

    if (routes.length) {
      const scanner = new PylonRouterScanner<T>(this.logger);

      for (const entry of routes) {
        if (isString(entry)) {
          const router = await scanner.scan(entry);
          this.router.use(router.routes(), router.allowedMethods());
        } else {
          this.addRouter(entry.path, entry.router);
        }
      }
    }

    this.server.use(this.router.routes());
    this.server.use(this.router.allowedMethods());

    this.logger.debug("Router loaded");
  }

  // private

  /** The evictable source — `cache`, or `kv` when the deployment runs one store. */
  private get cache(): IProteusSource | undefined {
    return this.options.cache ?? this.options.kv;
  }

  private addMiddleware(middleware: Array<PylonHttpMiddleware<T>>): void {
    for (const mw of middleware) {
      if (!mw) continue;
      this.logger.debug("Adding middleware", {
        middleware: mw.name ?? mw.constructor.name,
      });
      this.middleware.push(mw);
    }
  }

  private addRouter(path: string, router: PylonRouter<T>): void {
    this.logger.debug("Adding router", { path });
    this.router.use(path, router.routes(), router.allowedMethods());
  }

  private resolveHealthCallback(): PylonHttpCallback<T> | undefined {
    const configured = this.options.callbacks?.health;

    if (configured === null) return undefined;
    if (configured) return configured;

    // `/health` is liveness: check I/O once, then latch success.
    return buildLivenessCallback<T>({
      bus: this.options.bus,
      db: this.options.db,
    });
  }

  private resolveReadyCallback(): PylonHttpCallback<T> | undefined {
    const configured = this.options.callbacks?.ready;

    if (configured === null) return undefined;
    if (configured) return configured;

    // `/ready` is readiness: check live I/O on every call, across EVERY
    // configured role. `kv` and `cache` can be separately deployed instances, so
    // leaving them out lets a pod whose session store is unreachable report
    // green while every login on it fails. `this.cache` resolves the fallback,
    // and the probe pings a doubly-named instance once.
    return buildReadinessCallback<T>({
      bus: this.options.bus,
      cache: this.cache,
      db: this.options.db,
      kv: this.options.kv,
    });
  }
}
