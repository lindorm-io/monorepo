import { PylonRouterScanner } from "#internal/classes/PylonRouterScanner";
import { createCommonContextInitialisationMiddleware } from "#internal/middleware/common-context-initialisation-middleware";
import { createQueueMiddleware } from "#internal/middleware/common-queue-middleware";
import { createSourcesMiddleware } from "#internal/middleware/common-sources-middleware";
import { createWebhookMiddleware } from "#internal/middleware/common-webhook-middleware";
import { createHttpBodyParserMiddleware } from "#internal/middleware/http-body-parser-middleware";
import { createHttpContextInitialisationMiddleware } from "#internal/middleware/http-context-initialisation-middleware";
import { createHttpCookiesMiddleware } from "#internal/middleware/http-cookies-middleware";
import { createHttpCorsMiddleware } from "#internal/middleware/http-cors-middleware";
import { createHttpDateValidationMiddleware } from "#internal/middleware/http-date-validation-middleware";
import { httpErrorHandlerMiddleware } from "#internal/middleware/http-error-handler-middleware";
import { httpQueryParserMiddleware } from "#internal/middleware/http-query-parser-middleware";
import { httpRequestLoggerMiddleware } from "#internal/middleware/http-request-logger-middleware";
import { httpResponseBodyMiddleware } from "#internal/middleware/http-response-body-middleware";
import { httpResponseLoggerMiddleware } from "#internal/middleware/http-response-logger-middleware";
import { httpResponseTimeMiddleware } from "#internal/middleware/http-response-time-middleware";
import { createHttpSessionMiddleware } from "#internal/middleware/http-session-middleware";
import { createHttpStateMiddleware } from "#internal/middleware/http-state-middleware";
import { parseAuthConfig } from "#internal/utils/auth/parse-auth-config";
import { createAuthRouter } from "#internal/utils/create-auth-router";
import { createHealthRouter } from "#internal/utils/create-health-router";
import { createWellKnownRouter } from "#internal/utils/create-well-known-router";
import { isArray, isString } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import Koa from "koa";
import {
  HttpCallback,
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonHttpOptions,
} from "../types";
import { PylonRouter } from "./PylonRouter";

export class PylonHttp<T extends PylonHttpContext = PylonHttpContext> {
  private readonly logger: ILogger;
  private readonly middleware: Array<PylonHttpMiddleware<T>>;
  private readonly options: PylonHttpOptions<T>;
  private readonly router: PylonRouter<T>;

  private _callback: HttpCallback | undefined;

  public readonly server: Koa;

  public constructor(options: PylonHttpOptions<T>) {
    this.logger = options.logger.child(["PylonHttp"]);

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
      createSourcesMiddleware({
        hermes: this.options.hermes,
        iris: this.options.iris,
        proteus: this.options.proteus,
      }),
      createQueueMiddleware(this.options.queue),
      createWebhookMiddleware(this.options.webhook),
    ]);

    this.logger.debug("Middleware loaded");
  }

  public loadRouters(): void {
    this.logger.debug("Loading routers");

    this.router.use(...this.middleware);

    this.addRouter("/health", createHealthRouter(this.options.callbacks?.health));
    this.addRouter("/.well-known", createWellKnownRouter(this.options));

    if (this.options.auth) {
      const config = parseAuthConfig(this.options.auth);
      this.addRouter(config.pathPrefix, createAuthRouter(config));
    }

    if (isString(this.options.httpRouters)) {
      const scanner = new PylonRouterScanner<T>(this.logger);
      const router = scanner.scan(this.options.httpRouters);

      this.router.use(router.routes(), router.allowedMethods());
    } else if (isArray(this.options.httpRouters)) {
      for (const router of this.options.httpRouters ?? []) {
        this.addRouter(router.path, router.router);
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
}
