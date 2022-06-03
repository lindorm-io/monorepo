/* eslint @typescript-eslint/no-var-requires: 0 */

import Koa from "koa";
import Router from "koa-router";
import bodyParser from "koa-bodyparser";
import userAgent from "koa-useragent";
import { DefaultLindormKoaContext, KoaAppOptions, DefaultLindormMiddleware } from "../types";
import { Environment } from "../enum";
import { ILogger } from "@lindorm-io/winston";
import { IntervalWorker } from "./IntervalWorker";
import { Server as HttpServer, createServer } from "http";
import { Server as IOServer } from "socket.io";
import { StructureScanner, StructureScannerOptions } from "./StructureScanner";
import { createHealthRouter, createHeartbeatRouter } from "../router";
import { isObject } from "lodash";
import {
  dataHandlingMiddleware,
  defaultStatusMiddleware,
  errorMiddleware,
  initContextMiddleware,
  initSocketContextMiddleware,
  metadataMiddleware,
  responseTimeMiddleware,
  serverInfoMiddleware,
  sessionLoggerMiddleware,
  socketIoMiddleware,
  socketLoggerMiddleware,
  utilContextMiddleware,
} from "../middleware/private";

export class KoaApp<Context extends DefaultLindormKoaContext = DefaultLindormKoaContext> {
  private readonly environment: Environment;
  private readonly host: string;
  private readonly httpServer: HttpServer;
  private readonly ioServer: IOServer;
  private readonly koaApp: Koa;
  private readonly koaRouter: Router;
  private readonly logger: ILogger;
  private readonly middleware: Array<DefaultLindormMiddleware<Context>>;
  private readonly port: number;
  private readonly setup?: () => Promise<void>;
  private readonly workers: Array<IntervalWorker>;

  private loaded: boolean;
  private started: boolean;

  public constructor(options: KoaAppOptions<Context>) {
    this.koaApp = new Koa();
    this.koaApp.keys = options.keys || [];

    this.koaRouter = new Router();

    this.environment = options.environment;
    this.host = options.host;
    this.loaded = false;
    this.logger = options.logger;
    this.port = options.port;
    this.setup = options.setup;
    this.started = false;
    this.workers = options.workers || [];
    this.httpServer = createServer(this.koaApp.callback());

    this.middleware = [
      userAgent,
      bodyParser(),
      defaultStatusMiddleware,
      dataHandlingMiddleware,
      initContextMiddleware,
      serverInfoMiddleware(options),
      utilContextMiddleware,
      metadataMiddleware,
      sessionLoggerMiddleware(this.logger),
      errorMiddleware,
      responseTimeMiddleware,
      ...(options.middleware || []),
    ];

    if (options.socket) {
      this.logger.verbose("attaching socket.io server");
      this.ioServer = new IOServer(this.httpServer, options.socketOptions);
      this.middleware.push(socketIoMiddleware(this.ioServer));

      const socketMiddleware = [
        initSocketContextMiddleware,
        socketLoggerMiddleware(this.logger),
        ...(options.socketMiddleware || []),
      ];

      for (const middleware of socketMiddleware) {
        this.ioServer.use(middleware);
      }

      if (options.socketListeners) {
        options.socketListeners(this.ioServer);
      }
    }

    this.addRoute("/health", createHealthRouter<Context>(options.heartbeatCallback));
    this.addRoute("/heartbeat", createHeartbeatRouter<Context>(options.heartbeatCallback));

    if (options.routerDirectory) {
      this.addRoutesAutomatically(options.routerDirectory);
    }
  }

  public get http(): HttpServer {
    return this.httpServer;
  }

  public set http(_: HttpServer) {
    throw new Error("Not allowed to set http server");
  }

  public get io(): IOServer {
    return this.ioServer;
  }

  public set io(_: IOServer) {
    throw new Error("Not allowed to set io server");
  }

  public get koa(): Koa {
    return this.koaApp;
  }

  public set koa(_: Koa) {
    throw new Error("Not allowed to set koa");
  }

  public get router(): Router {
    return this.koaRouter;
  }
  public set router(_: Router) {
    throw new Error("Not allowed to set router");
  }

  public callback(): any {
    this.load();

    return this.koaApp.callback();
  }

  public addMiddleware(middleware: DefaultLindormMiddleware<any>): void {
    this.middleware.push(middleware);
  }

  public addMiddlewares(middlewares: Array<DefaultLindormMiddleware<any>>): void {
    for (const middleware of middlewares) {
      this.addMiddleware(middleware);
    }
  }

  public addRoute(route: string, router: Router): void {
    if (!isObject(router)) {
      throw new Error(`Invalid router [ ${typeof router} ]`);
    }

    this.logger.debug("adding route", { route });

    this.koaRouter.use(route, router.routes(), router.allowedMethods());
  }

  public addRoutesAutomatically(directory: string, options?: StructureScannerOptions): void {
    if (!StructureScanner.hasItems(directory)) {
      throw new Error(`Router directory [ ${directory} ] is empty`);
    }

    const scanner = new StructureScanner(directory, options);

    for (const file of scanner.scan()) {
      const router: Router = require(file.path).default;

      this.addRoute(scanner.getRoute(file), router);
    }
  }

  public addWorker(worker: IntervalWorker): void {
    this.workers.push(worker);
  }

  public addWorkers(workers: Array<IntervalWorker>): void {
    for (const worker of workers) {
      this.addWorker(worker);
    }
  }

  public load(): void {
    if (this.loaded) return;

    this.loadMiddleware();
    this.loadRouter();
    this.loadEmitter();

    this.loaded = true;

    this.logger.debug("server is loaded");
  }

  public async start(): Promise<void> {
    if (this.started) return;

    const promise = this.waitForStartEvent();

    this.logger.info("starting server", {
      environment: this.environment,
      host: this.host,
      port: this.port,
    });

    this.load();
    this.listen();

    if (this.setup) {
      this.logger.debug("initialising setup");
      await this.setup();
    }

    await promise;

    this.started = true;

    this.logger.debug("server has started");
  }

  private listen(): void {
    this.httpServer.listen(this.port, (): void => {
      this.logger.verbose("server listening on port", {
        port: this.port,
      });

      this.koaApp.emit("start");
    });
  }

  private loadEmitter(): void {
    this.koaApp.on("error", (error): void => {
      console.error("app caught error", error);
    });

    this.koaApp.on("start", (): void => {
      this.loadWorkers();
    });
  }

  private loadMiddleware(): void {
    this.logger.debug("loading middleware");

    for (const middleware of this.middleware) {
      this.koaApp.use(middleware);
    }
  }

  private loadRouter(): void {
    this.logger.debug("loading router");

    this.koaApp.use(this.koaRouter.routes());
    this.koaApp.use(this.koaRouter.allowedMethods());
  }

  private loadWorkers(): void {
    this.logger.debug("loading workers");

    for (const worker of this.workers) {
      worker.start();
      worker.trigger();
    }
  }

  private async waitForStartEvent(): Promise<void> {
    this.logger.debug("waiting for start event");

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("server start has timed out"));
      }, 30000);

      this.koaApp.on("start", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
}

export { Router };
