import { IAmphora } from "@lindorm/amphora";
import { ReadableTime } from "@lindorm/date";
import { Environment } from "@lindorm/enums";
import { isArray, isString } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import { OpenIdConfiguration } from "@lindorm/types";
import Koa from "koa";
import userAgent from "koa-useragent";
import {
  createHttpBodyParserMiddleware,
  createHttpContextInitialisationMiddleware,
  createHttpCookieMiddleware,
  createHttpCorsMiddleware,
  createHttpMetadataMiddleware,
  httpErrorHandlerMiddleware,
  httpQueryParserMiddleware,
  httpRequestLoggerMiddleware,
  httpResponseBodyMiddleware,
  httpResponseTimeMiddleware,
} from "../middleware/private";
import { httpResponseLoggerMiddleware } from "../middleware/private/http-response-logger-middleware";
import { createHttpSessionMiddleware } from "../middleware/private/http-session-middleware";
import {
  CorsOptions,
  HttpCallback,
  ParseBodyOptions,
  PylonCookieConfig,
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonHttpOptions,
  PylonHttpRouters,
  PylonSessionConfig,
} from "../types";
import {
  createHealthRouter,
  createWellKnownRouter,
  getCookieKeys,
} from "../utils/private";
import { PylonRouter } from "./PylonRouter";
import { PylonRouterScanner } from "./private";

export class PylonHttp<T extends PylonHttpContext = PylonHttpContext> {
  private readonly amphora: IAmphora;
  private readonly cookies: PylonCookieConfig | undefined;
  private readonly cors: CorsOptions | undefined;
  private readonly environment: Environment;
  private readonly httpMaxRequestAge: ReadableTime | undefined;
  private readonly issuer: string | null;
  private readonly logger: ILogger;
  private readonly middleware: Array<PylonHttpMiddleware<T>>;
  private readonly openIdConfiguration: Partial<OpenIdConfiguration>;
  private readonly parseBody: ParseBodyOptions | undefined;
  private readonly router: PylonRouter<T>;
  private readonly routers: Array<PylonHttpRouters<T>> | string | undefined;
  private readonly session: PylonSessionConfig | undefined;
  private readonly version: string;

  private _callback: HttpCallback | undefined;

  public readonly server: Koa;

  public constructor(options: PylonHttpOptions<T>) {
    options.environment = options.environment ?? Environment.Development;
    options.version = options.version ?? "0.0.0";
    options.issuer = options.issuer ?? options.amphora.issuer;

    this.logger = options.logger.child(["PylonHttp"]);

    this.amphora = options.amphora;
    this.cookies = options.cookies;
    this.cors = options.cors;
    this.environment = options.environment;
    this.httpMaxRequestAge = options.maxRequestAge;
    this.issuer = options.issuer;
    this.middleware = [];
    this.openIdConfiguration = options.openIdConfiguration ?? {};
    this.parseBody = options.parseBody;
    this.router = new PylonRouter<T>();
    this.routers = options.httpRouters;
    this.session = options.session;
    this.version = options.version;

    this.server = new Koa({ keys: getCookieKeys(this.amphora) });
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

    this.server.use(createHttpCorsMiddleware(this.cors));

    // middleware

    this.addMiddleware([
      userAgent,
      httpResponseTimeMiddleware,
      httpResponseLoggerMiddleware,
      httpErrorHandlerMiddleware,
      createHttpMetadataMiddleware({
        environment: this.environment,
        httpMaxRequestAge: this.httpMaxRequestAge ?? "10s",
        version: this.version,
      }),
      createHttpContextInitialisationMiddleware({
        amphora: this.amphora,
        logger: this.logger,
      }),
      createHttpCookieMiddleware(this.cookies),
      createHttpSessionMiddleware(this.session),
      createHttpBodyParserMiddleware(this.parseBody),
      httpQueryParserMiddleware,
      httpRequestLoggerMiddleware,
      httpResponseBodyMiddleware,
    ]);

    this.logger.debug("Middleware loaded");
  }

  public loadRouters(): void {
    this.logger.debug("Loading routers");

    this.router.use(...this.middleware);

    this.addRouter("/health", createHealthRouter());
    this.addRouter(
      "/.well-known",
      createWellKnownRouter({
        issuer: this.issuer,
        openIdConfiguration: this.openIdConfiguration,
      }),
    );

    if (isString(this.routers)) {
      const scanner = new PylonRouterScanner<T>(this.logger);
      const router = scanner.scan(this.routers);

      this.router.use(router.routes(), router.allowedMethods());
    } else if (isArray(this.routers)) {
      for (const router of this.routers ?? []) {
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
