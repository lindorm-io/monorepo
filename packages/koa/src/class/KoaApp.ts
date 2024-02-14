/* eslint @typescript-eslint/no-var-requires: 0 */

import { Environment } from "@lindorm-io/common-enums";
import { Logger } from "@lindorm-io/core-logger";
import { ScanData, StructureScanner } from "@lindorm-io/structure-scanner";
import { Server as HttpServer, createServer } from "http";
import Koa, { Middleware } from "koa";
import bodyParser from "koa-bodyparser";
import Router from "koa-router";
import userAgent from "koa-useragent";
import { Server as IOServer } from "socket.io";
import {
  defaultStatusMiddleware,
  errorMiddleware,
  initContextMiddleware,
  initSocketContextMiddleware,
  metadataMiddleware,
  requestDataMiddleware,
  responseDataMiddleware,
  responseTimeMiddleware,
  sessionLoggerMiddleware,
  socketIoMiddleware,
  utilContextMiddleware,
} from "../middleware/private";
import { createHealthRouter, createHeartbeatRouter } from "../router";
import { DefaultLindormKoaContext, DefaultLindormMiddleware, KoaAppOptions } from "../types";
import { IntervalWorker } from "./IntervalWorker";

export class KoaApp<Context extends DefaultLindormKoaContext = DefaultLindormKoaContext> {
  private readonly environment: Environment;
  private readonly host: string;
  private readonly httpServer: HttpServer;
  private readonly ioServer: IOServer | undefined;
  private readonly koaApp: Koa;
  private readonly koaRouter: Router;
  private readonly logger: Logger;
  private readonly middleware: Array<DefaultLindormMiddleware<Context>>;
  private readonly port: number;
  private readonly routerDirectory: string | undefined;
  private readonly scanner: StructureScanner;
  private readonly setup: () => Promise<void>;
  private readonly startWorkers: boolean;
  private readonly workers: Array<IntervalWorker>;

  private loaded: boolean;
  private started: boolean;

  public constructor(options: KoaAppOptions<Context>) {
    this.koaApp = new Koa();
    this.koaApp.keys = options.keys || [];

    this.koaRouter = new Router();

    this.environment = options.environment || Environment.DEVELOPMENT;
    this.host = options.host;
    this.loaded = false;
    this.logger = options.logger.createChildLogger("koa");
    this.port = options.port;
    this.routerDirectory = options.routerDirectory;
    this.setup = options.setup ? options.setup : () => Promise.resolve();
    this.started = false;
    this.startWorkers = options.startWorkers ?? false;
    this.workers = options.workers || [];

    this.scanner = new StructureScanner({
      deniedTypes: [/^fixture$/, /^spec$/, /^test$/, /^integration$/],
    });

    this.middleware = [
      userAgent,
      bodyParser(),
      defaultStatusMiddleware,
      initContextMiddleware(options),
      utilContextMiddleware,
      requestDataMiddleware,
      metadataMiddleware,
      sessionLoggerMiddleware(this.logger),
      errorMiddleware,
      responseDataMiddleware,
      responseTimeMiddleware,
      ...(options.middleware || []),
    ];

    this.httpServer = createServer(this.koaApp.callback());

    if (options.socket) {
      this.logger.verbose("attaching socket.io server");
      this.ioServer = new IOServer(this.httpServer, options.socketOptions);
      this.middleware.push(socketIoMiddleware(this.ioServer));

      const socketMiddleware = [
        initSocketContextMiddleware(this.logger),
        ...(options.socketMiddleware || []),
      ];

      for (const middleware of socketMiddleware) {
        this.ioServer.use(middleware as any);
      }

      if (options.socketListeners) {
        options.socketListeners(this.ioServer);
      }
    }

    this.addRoute("/health", createHealthRouter<Context>(options.heartbeatCallback));
    this.addRoute("/heartbeat", createHeartbeatRouter<Context>(options.heartbeatCallback));

    this.addRoutesAutomatically();
  }

  public get http(): HttpServer {
    return this.httpServer;
  }

  public set http(_: HttpServer) {
    throw new Error("Not allowed to set http server");
  }

  public get io(): IOServer {
    if (!this.ioServer) {
      throw new Error("IOServer has not been initialised");
    }
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

  public addMiddleware(
    middleware: DefaultLindormMiddleware<any> | Array<DefaultLindormMiddleware<any>>,
  ): void {
    if (Array.isArray(middleware)) {
      for (const item of middleware) {
        this.addMiddleware(item);
      }
      return;
    }

    this.middleware.push(middleware);
  }

  public addRoute(path: string, router: Router): void {
    this.logger.debug("Adding route", { path });

    if (!(router instanceof Router)) {
      throw new Error(`Invalid router [ ${JSON.stringify(router)} ]`);
    }

    this.koaRouter.use(path, router.routes(), router.allowedMethods());
  }

  public addWorker(worker: IntervalWorker | Array<IntervalWorker>): void {
    if (Array.isArray(worker)) {
      for (const item of worker) {
        this.addWorker(item);
      }

      return;
    }

    this.workers.push(worker);
  }

  public load(): void {
    if (this.loaded) return;

    this.loadMiddleware();
    this.loadRouter();
    this.loadErrorListener();

    this.loaded = true;

    this.logger.debug("Server is loaded");
  }

  public async start(): Promise<void> {
    if (this.started) return;

    this.logger.info("Starting server", {
      environment: this.environment,
      host: this.host,
      port: this.port,
    });

    this.load();
    await this.listen();
    await this.setup();

    if (this.startWorkers) {
      this.logger.info("Loading workers");
      this.loadWorkers();
    }

    this.started = true;

    this.logger.debug("Server has started");
  }

  // private

  private async listen(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.port, (): void => {
        this.logger.verbose("Server listening on port", {
          port: this.port,
        });

        this.koaApp.emit("start");

        return resolve();
      });
    });
  }

  private loadErrorListener(): void {
    this.koaApp.on("error", (error): void => {
      console.error("App caught error", error);
    });
  }

  private loadMiddleware(): void {
    this.logger.debug("Loading middleware");

    for (const middleware of this.middleware) {
      this.koaApp.use(middleware);
    }
  }

  private loadRouter(): void {
    this.logger.debug("Loading Router");

    this.koaApp.use(this.koaRouter.routes());
    this.koaApp.use(this.koaRouter.allowedMethods());
  }

  private loadWorkers(): void {
    this.logger.debug("Loading workers");

    for (const worker of this.workers) {
      worker.start();
      worker.trigger();
    }
  }

  // private router

  private addRoutesAutomatically(): void {
    if (!this.routerDirectory) return;

    const start = Date.now();

    this.logger.debug("Adding routes automatically", { directory: this.routerDirectory });

    if (!StructureScanner.hasFiles(this.routerDirectory)) {
      throw new Error(`Router directory [ ${this.routerDirectory} ] is empty`);
    }

    const scan = this.scanner.scan(this.routerDirectory);

    this.logger.silly("StructureScanner resolved files", { scan });

    this.addRouterFromScanArray(scan, false);

    this.logger.debug("Routes added automatically", {
      directory: this.routerDirectory,
      time: Date.now() - start,
    });
  }

  private addRouterFromDirectory(scan: ScanData, parentRouter: Router): void {
    if (!scan.isDirectory) return;
    if (!scan.children.length) return;

    const path = this.getRouteName(scan);
    const router = this.addRouterFromScanArray(scan.children, true);

    this.logger.silly("Adding router directory", { path, parents: scan.parents });

    parentRouter.use(path, router.routes(), router.allowedMethods());
  }

  private addRouterFromFile(scanData: ScanData, parentRouter: Router): void {
    if (!scanData.isFile) return;

    const router = this.findRouterInFile(scanData);
    const path = this.getRouteName(scanData);

    this.logger.debug("Adding router", {
      path: "/" + [scanData.parents, path.replace("/", "")].flat().join("/").replace("//", ""),
    });

    parentRouter.use(path, router.routes(), router.allowedMethods());
  }

  private addConfig(scanData: ScanData, router: Router<any, any>): void {
    const file = this.scanner.require<{ middleware?: Array<Middleware> }>(scanData.fullPath);
    const path = this.getRouteName(scanData);

    this.logger.debug("Adding config", {
      path: "/" + [scanData.parents, path.replace("/", "")].flat().join("/").replace("//", ""),
    });

    for (const middleware of file.middleware || []) {
      router.use(middleware);
    }
  }

  private addRouterFromScanArray(array: Array<ScanData>, createRouter: boolean): Router<any, any> {
    const index = array.find((c) => c.baseName === "index" && c.type === null);
    const config = array.find((c) => c.baseName === "index" && c.type === "config");
    const files = array.filter((c) => c.baseName !== "index");

    const router = index
      ? this.findRouterInFile(index)
      : createRouter
      ? new Router<any, any>()
      : this.koaRouter;

    if (config) {
      this.addConfig(config, router);
    }

    for (const file of files) {
      if (file.isDirectory) {
        this.addRouterFromDirectory(file, router);
      } else if (file.isFile) {
        this.addRouterFromFile(file, router);
      }
    }

    this.logger.silly("Added router from scan array", { array, createRouter });

    return router;
  }

  private getRouteName(scanData: ScanData): string {
    const path = scanData.baseName.replace(/index/, "");

    if (path.startsWith("[") && path.endsWith("]")) {
      const replaced = path.replace("[", ":").replace("]", "");

      this.logger.debug("Route with param", { path, replaced });

      return "/" + replaced;
    }

    return "/" + path;
  }

  private findRouterInFile(scan: ScanData): Router<any, any> {
    const file = this.scanner.require<{ default?: Router<any, any>; router?: Router<any, any> }>(
      scan.fullPath,
    );

    const router = file.router ? file.router : file.default ? file.default : undefined;

    if (!router) {
      throw new Error(
        `File [ ${scan.relativePath} ] has no exported router from [ default | router ]`,
      );
    }

    return router;
  }
}

export { Router };
