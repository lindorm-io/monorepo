import { IAmphora } from "@lindorm/amphora";
import { Environment } from "@lindorm/enums";
import { ILogger } from "@lindorm/logger";
import { ILindormWorker } from "@lindorm/worker";
import { Server as HttpServer, createServer } from "http";
import { httpSocketIoMiddleware } from "../middleware/private";
import {
  HttpCallback,
  PylonHttpContext,
  PylonOptions,
  PylonSetup,
  PylonSocketContext,
  PylonTeardown,
} from "../types";
import { scanWorkers } from "../utils/private";
import { PylonHttp } from "./PylonHttp";
import { PylonIo } from "./PylonIo";

export class Pylon<
  C extends PylonHttpContext = PylonHttpContext,
  E extends PylonSocketContext = PylonSocketContext,
> {
  private readonly amphora: IAmphora;
  private readonly http: PylonHttp<C>;
  private readonly io: PylonIo<E> | undefined;
  private readonly logger: ILogger;
  private readonly port: number;
  private readonly server: HttpServer;
  private readonly workers: Array<ILindormWorker>;

  private isStarted: boolean;
  private isSetup: boolean;
  private isTeardown: boolean;

  private readonly _setup: PylonSetup | undefined;
  private readonly _teardown: PylonTeardown | undefined;

  public constructor(options: PylonOptions<C, E>) {
    options.environment = options.environment ?? Environment.Development;
    options.version = options.version ?? "0.0.0";
    options.domain = options.domain ?? options.amphora.domain ?? "unknown";

    this.logger = options.logger.child(["Pylon"], {
      domain: options.domain,
      environment: options.environment,
      name: options.name ?? "unknown",
      version: options.version,
    });

    this.isSetup = false;
    this.isStarted = false;
    this.isTeardown = false;

    this.amphora = options.amphora;
    this.port = options.port ?? 3000;
    this.workers = scanWorkers(options);

    this._setup = options.setup;
    this._teardown = options.teardown;

    this.http = new PylonHttp({
      amphora: this.amphora,
      auth: options.auth,
      cookies: options.cookies,
      cors: options.cors,
      domain: options.domain,
      environment: options.environment,
      handlers: options.handlers,
      httpMiddleware: options.httpMiddleware,
      httpRouters: options.httpRouters,
      logger: this.logger,
      maxRequestAge: options.maxRequestAge,
      openIdConfiguration: options.openIdConfiguration,
      parseBody: options.parseBody,
      session: options.session,
      version: options.version,
    });

    this.server = createServer(this.http.server.callback());

    this.http.loadMiddleware();

    if (options.socketListeners) {
      this.io = new PylonIo(this.server, {
        amphora: this.amphora,
        socketListeners: options.socketListeners,
        logger: this.logger,
        socketMiddleware: options.socketMiddleware,
        socketOptions: options.socketOptions,
        socketRedis: options.socketRedis,
      });

      this.http.use([httpSocketIoMiddleware(this.io.server)]);
    }

    this.http.use(options.httpMiddleware ?? []);

    this.http.loadRouters();
    this.io?.load();
  }

  // public getters

  public get callback(): HttpCallback {
    return this.http.callback;
  }

  // public

  public async setup(): Promise<void> {
    if (this.isSetup) return;

    await this.amphora.setup();

    if (this._setup) {
      try {
        const result = await this._setup();
        this.logger.verbose("Pylon setup", { result });
      } catch (error: any) {
        this.logger.error("Pylon failed to setup", error);
        process.exit(1);
      }
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

    process.on("SIGINT", this.handleSignal.bind(this, "SIGINT"));
    process.on("SIGTERM", this.handleSignal.bind(this, "SIGTERM"));
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

    process.removeListener("SIGINT", this.handleSignal.bind(this, "SIGINT"));
    process.removeListener("SIGTERM", this.handleSignal.bind(this, "SIGTERM"));
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

  public async work(): Promise<void> {
    if (this.isStarted) return;

    this.logger.verbose("Pylon workers starting");

    await this.setup();

    for (const worker of this.workers) {
      worker.start();
    }

    this.isStarted = true;

    this.logger.info("Pylon workers started");
  }

  // private

  private async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err): void => {
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
      this.server.listen(this.port, (): void => {
        this.logger.verbose("Pylon listening");
        return resolve();
      });
    });
  }

  private handleSignal(signal: string): void {
    this.logger.info("Pylon received signal", { signal });

    this.stop()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));

    setTimeout(() => {
      this.logger.warn("Forcing shutdown due to timeout");
      process.exit(1);
    }, 10000).unref();
  }
}
