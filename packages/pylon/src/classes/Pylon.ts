import { Environment } from "@lindorm/enums";
import { isArray, isString } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import { uniq } from "@lindorm/utils";
import { ILindormWorker } from "@lindorm/worker";
import { createAdapter } from "@socket.io/redis-adapter";
import { Server as HttpServer, createServer } from "http";
import Koa from "koa";
import userAgent from "koa-useragent";
import { Server as SocketIoServer } from "socket.io";
import {
  createEventContextInitialisationMiddleware,
  createHttpContextInitialisationMiddleware,
  createHttpMetadataMiddleware,
  eventErrorHandlerMiddleware,
  eventLoggerMiddleware,
  httpBodyParserMiddleware,
  httpErrorHandlerMiddleware,
  httpResponseMiddleware,
  httpSessionLoggerMiddleware,
  httpSocketIoMiddleware,
} from "../middleware/private";
import {
  HttpCallback,
  IoServer,
  IoSocket,
  PylonEventContext,
  PylonEventMiddleware,
  PylonHttpContext,
  PylonHttpMiddleware,
  PylonOptions,
  PylonSetup,
  PylonSocket,
  PylonTeardown,
} from "../types";
import {
  createHealthRouter,
  createWellKnownRouter,
  initialisePylonSocketData,
  loadPylonListeners,
} from "../utils/private";
import { PylonListener } from "./PylonListener";
import { PylonRouter } from "./PylonRouter";
import { PylonListenerScanner, PylonRouterScanner } from "./private";

export class Pylon<
  C extends PylonHttpContext = PylonHttpContext,
  E extends PylonEventContext = PylonEventContext,
> {
  private readonly http: HttpServer;
  private readonly httpMiddleware: Array<PylonHttpMiddleware<C>>;
  private readonly io: IoServer | undefined;
  private readonly koa: Koa;
  private readonly router: PylonRouter<C>;
  private readonly logger: ILogger;
  private readonly port: number;
  private readonly workers: Array<ILindormWorker>;
  private isStarted: boolean;
  private isSetup: boolean;
  private isTeardown: boolean;

  private readonly _setup: PylonSetup | undefined;
  private readonly _teardown: PylonTeardown | undefined;
  private _callback: HttpCallback | undefined;

  public constructor(options: PylonOptions<C, E>) {
    const environment = options.environment ?? Environment.Development;
    const version = options.version ?? "0.0.0";

    this.logger = options.logger.child(["Pylon"], {
      domain: options.domain ?? "unknown",
      environment,
      name: options.name ?? "unknown",
      version,
    });

    this.isSetup = false;
    this.isStarted = false;
    this.isTeardown = false;

    this.httpMiddleware = [];
    this.port = options.port ?? 3000;
    this.workers = options.workers ?? [];

    this._setup = options.setup;
    this._teardown = options.teardown;

    this.koa = new Koa();
    this.koa.keys = options.keys ?? [];
    this.router = new PylonRouter<C>();
    this.http = createServer(this.koa.callback());

    // middleware

    this.addHttpMiddleware([
      userAgent,
      httpBodyParserMiddleware(options.parseBody),
      createHttpMetadataMiddleware({ environment, version }),
      createHttpContextInitialisationMiddleware({
        amphora: options.amphora,
        issuer: options.issuer,
        logger: this.logger,
      }),
      httpSessionLoggerMiddleware,
      httpResponseMiddleware,
      httpErrorHandlerMiddleware,
    ]);

    // socket

    if (options.socketListeners) {
      this.io = new SocketIoServer(this.http, {
        ...(options.socketOptions ?? {}),
        ...(options.socketRedis
          ? {
              adapter: createAdapter(
                options.socketRedis.duplicate(),
                options.socketRedis.duplicate(),
              ),
            }
          : {}),
      });

      this.addHttpMiddleware([httpSocketIoMiddleware(this.io)]);
    }

    this.addHttpMiddleware(options.httpMiddleware ?? []);

    this.loadHttp(options);
    this.loadIo(options);
  }

  // public getters

  public get callback(): HttpCallback {
    if (this._callback) return this._callback;

    this._callback = this.koa.callback();

    return this._callback;
  }

  // public

  public async setup(): Promise<void> {
    if (this.isSetup) return;

    if (this._setup) {
      const result = await this._setup();
      this.logger.verbose("Pylon setup", { result });
    }

    this.isSetup = true;
    this.isTeardown = false;
  }

  public async start(): Promise<void> {
    if (this.isStarted) return;

    this.logger.verbose("Pylon starting", { port: this.port });

    await this.setup();
    await this.listen();

    for (const worker of this.workers) {
      worker.start();
    }

    this.isStarted = true;

    this.logger.info("Pylon started", { port: this.port });
  }

  public async stop(): Promise<void> {
    if (!this.isStarted) return;

    this.logger.verbose("Pylon stopping");

    await this.close();
    await this.teardown();

    for (const worker of this.workers) {
      worker.stop();
    }

    this.isStarted = false;

    this.logger.info("Pylon stopped");
  }

  public async teardown(): Promise<void> {
    if (!this._teardown) return;
    if (this.isTeardown) return;

    if (this._teardown) {
      const result = await this._teardown();
      this.logger.verbose("Pylon teardown", { result });
    }

    this.isSetup = false;
    this.isTeardown = true;
  }

  // private

  private addHttpMiddleware(middleware: Array<PylonHttpMiddleware<C>>): void {
    for (const mw of middleware) {
      this.logger.debug("Adding middleware", {
        middleware: mw.name ?? mw.constructor.name,
      });
      this.httpMiddleware.push(mw);
    }
  }

  private addHttpRouter(path: string, router: PylonRouter<C>): void {
    this.logger.debug("Adding router", { path });
    this.router.use(path, router.routes(), router.allowedMethods());
  }

  private async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.close((err): void => {
        if (err) {
          this.logger.error("Pylon failed to close", err);
          return reject(err);
        } else {
          this.logger.verbose("Pylon closed");
          return resolve();
        }
      });
    });
  }

  private async listen(): Promise<void> {
    return new Promise((resolve) => {
      this.http.listen(this.port, (): void => {
        this.logger.verbose("Pylon listening");
        return resolve();
      });
    });
  }

  private loadHttp(options: PylonOptions<C, E>): void {
    this.logger.verbose("Pylon loading routers");

    this.router.use(...this.httpMiddleware);

    this.addHttpRouter("/health", createHealthRouter());
    this.addHttpRouter("/.well-known", createWellKnownRouter(options));

    if (isString(options.httpRouters)) {
      const scanner = new PylonRouterScanner<C>(this.logger);
      const router = scanner.scan(options.httpRouters);

      this.router.use(router.routes(), router.allowedMethods());
    } else if (isArray(options.httpRouters)) {
      for (const router of options.httpRouters ?? []) {
        this.addHttpRouter(router.path, router.router);
      }
    }

    this.logger.info("Pylon router loaded");

    this.koa.use(this.router.routes());
    this.koa.use(this.router.allowedMethods());
  }

  private loadIo(options: PylonOptions<C, E>): void {
    if (!this.io) return;

    this.logger.verbose("Pylon loading listeners");

    const listeners: Array<PylonListener<E>> = [];
    const namespaces: Array<string> = [];

    if (isString(options.socketListeners)) {
      const scanner = new PylonListenerScanner<E>(this.logger);
      const result = scanner.scan(options.socketListeners);

      listeners.push(...result.listeners);
      namespaces.push(...result.namespaces);
    } else if (isArray(options.socketListeners)) {
      for (const listener of options.socketListeners) {
        listeners.push(listener);
        if (listener.namespace) {
          namespaces.push(listener.namespace);
        }
      }
    }

    const middleware = [
      createEventContextInitialisationMiddleware({
        amphora: options.amphora,
        issuer: options.issuer,
        logger: this.logger,
      }),
      eventLoggerMiddleware,
      eventErrorHandlerMiddleware,
      ...(options.socketMiddleware ?? []),
    ];

    const stdListeners = listeners.filter((listener) => !listener.namespace);

    this.logger.silly("Creating connection handler", { listeners: stdListeners });

    this.io.on("connection", (socket) => {
      this.createSocketConnectionHandler(this.io!, socket, middleware, stdListeners);
    });

    for (const namespace of uniq(namespaces)) {
      const nsListeners = listeners.filter(
        (listener) => listener.namespace === namespace,
      );

      this.logger.silly("Creating namespace connection handler", {
        namespace,
        listeners: nsListeners,
      });

      this.io.of(namespace).on("connection", (socket) => {
        this.createSocketConnectionHandler(this.io!, socket, middleware, nsListeners);
      });
    }

    this.logger.info("Pylon listeners loaded");
  }

  private createSocketConnectionHandler(
    io: IoServer,
    socket: IoSocket,
    middleware: Array<PylonEventMiddleware<E>>,
    listeners: Array<PylonListener<E>>,
  ): void {
    socket.data = initialisePylonSocketData();

    loadPylonListeners(io, socket as PylonSocket, middleware, listeners);

    socket.on("disconnect", () => {
      this.logger.verbose("Socket disconnected", { socket: socket.id });
    });
  }
}
