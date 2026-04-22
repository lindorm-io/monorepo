import { PylonRouterScanner } from "../internal/classes/PylonRouterScanner.js";
import { createCommonContextInitialisationMiddleware } from "../internal/middleware/common-context-initialisation-middleware.js";
import { createQueueMiddleware } from "../internal/middleware/common-queue-middleware.js";
import { createDependenciesMiddleware } from "../internal/middleware/common-dependencies-middleware.js";
import { createWebhookMiddleware } from "../internal/middleware/common-webhook-middleware.js";
import { createHttpAbortSignalMiddleware } from "../internal/middleware/http-abort-signal-middleware.js";
import { createHttpBodyParserMiddleware } from "../internal/middleware/http-body-parser-middleware.js";
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
import { buildDefaultHealthCallback } from "../internal/utils/build-default-health-callback.js";
import { createAuthRouter } from "../internal/utils/create-auth-router.js";
import { createHealthRouter } from "../internal/utils/create-health-router.js";
import { createWellKnownRouter } from "../internal/utils/create-well-known-router.js";
import { normaliseRoutes } from "../internal/utils/normalise-routes.js";
import { isString } from "@lindorm/is";
import type { ILogger } from "@lindorm/logger";
import Koa from "koa";
import { useRateLimit } from "../middleware/common/use-rate-limit.js";
import type {
  HttpCallback,
  PylonAuthConfig,
  PylonHttpCallback,
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonHttpOptions,
} from "../types/index.js";
import { PylonRouter } from "./PylonRouter.js";

export class PylonHttp<T extends PylonHttpContext = PylonHttpContext> {
  private readonly authConfig: PylonAuthConfig | undefined;
  private readonly logger: ILogger;
  private readonly middleware: Array<PylonHttpMiddleware<T>>;
  private readonly options: PylonHttpOptions<T>;
  private readonly router: PylonRouter<T>;

  private _callback: HttpCallback | undefined;

  public readonly server: Koa;

  public constructor(options: PylonHttpOptions<T>) {
    this.logger = options.logger.child(["PylonHttp"]);

    this.authConfig = options.auth ? parseAuthConfig(options.auth) : undefined;
    this.middleware = [];
    this.options = options;
    this.router = new PylonRouter<T>();
    this.server = new Koa({ proxy: options.proxy ?? true });
  }

  // public

  public get callback(): HttpCallback {
    if (this._callback) return this._callback;

    this._callback = this.server.callback();

    return this._callback;
  }

  public use(middleware: Array<PylonHttpMiddleware<T>>): void {
    this.addMiddleware(middleware);
  }

  public loadMiddleware(): void {
    this.logger.debug("Loading middleware");

    this.server.use(createHttpCorsMiddleware(this.options.cors));

    // middleware

    this.addMiddleware([
      httpResponseTimeMiddleware,
      httpResponseLoggerMiddleware,
      httpErrorHandlerMiddleware,
      createHttpStateMiddleware({
        environment: this.options.environment,
        name: this.options.name,
        version: this.options.version,
      }),
      createHttpContextInitialisationMiddleware(this.logger),
      createHttpAbortSignalMiddleware(),
      createCommonContextInitialisationMiddleware(this.options.amphora),
      createHttpDateValidationMiddleware({
        minRequestAge: this.options.minRequestAge,
        maxRequestAge: this.options.maxRequestAge,
      }),
      createHttpCookiesMiddleware(this.options.cookies),
      ...(this.options.session
        ? [createHttpSessionMiddleware(this.options.session)]
        : []),
      createHttpBodyParserMiddleware(this.options.parseBody),
      httpQueryParserMiddleware,
      httpRequestLoggerMiddleware,
      httpResponseBodyMiddleware,
      createDependenciesMiddleware({
        actor: this.options.actor ?? this.options.audit?.actor,
        authConfig: this.authConfig,
        auditConfig:
          this.options.audit?.enabled && (this.options.audit.iris ?? this.options.iris)
            ? {
                iris: this.options.audit.iris ?? this.options.iris!,
                sanitise: this.options.audit.sanitise,
                skip: this.options.audit.skip,
              }
            : undefined,
        hermes: this.options.hermes,
        iris: this.options.iris,
        proteus: this.options.proteus,
        rateLimitProteus: this.options.rateLimit?.enabled
          ? (this.options.rateLimit.proteus ?? this.options.proteus)
          : undefined,
      }),
      createQueueMiddleware(this.options.queue),
      createWebhookMiddleware(this.options.webhook),
      ...(this.options.rateLimit?.enabled &&
      this.options.rateLimit.window &&
      this.options.rateLimit.max
        ? [
            useRateLimit({
              window: this.options.rateLimit.window,
              max: this.options.rateLimit.max,
              strategy: this.options.rateLimit.strategy,
              key: this.options.rateLimit.key,
              skip: this.options.rateLimit.skip,
            }),
          ]
        : []),
    ]);

    this.logger.debug("Middleware loaded");
  }

  public async loadRouters(): Promise<void> {
    this.logger.debug("Loading routers");

    this.router.use(...this.middleware);

    this.addRouter("/health", createHealthRouter(this.resolveHealthCallback()));
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

    return buildDefaultHealthCallback<T>({
      iris: this.options.iris,
      proteus: this.options.proteus,
    });
  }
}
