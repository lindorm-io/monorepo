import { IAmphora } from "@lindorm/amphora";
import { ConduitClientCredentialsCache } from "@lindorm/conduit";
import { ILogger } from "@lindorm/logger";
import { ILindormWorker } from "@lindorm/worker";
import { Server as HttpServer, createServer } from "http";
import { httpSocketIoMiddleware } from "#internal/middleware";
import {
  HttpCallback,
  PylonHttpContext,
  PylonOptions,
  PylonSetup,
  PylonSocketContext,
  PylonSource,
  PylonSubscribeOptions,
  PylonTeardown,
} from "../types";
import { SessionEntity } from "../entities";
import { calculateSubscriptions, calculateWorkers, scanWorkers } from "#internal/utils";
import { PylonHttp } from "./PylonHttp";
import { PylonIo } from "./PylonIo";

export class Pylon<
  H extends PylonHttpContext = PylonHttpContext,
  S extends PylonSocketContext = PylonSocketContext,
> {
  private readonly amphora: IAmphora;
  private readonly http: PylonHttp<H>;
  private readonly io: PylonIo<S> | undefined;
  private readonly logger: ILogger;
  private readonly options: PylonOptions<H, S>;
  private readonly port: number;
  private readonly server: HttpServer;
  private readonly sources: Map<string, PylonSource>;
  private readonly subscriptions: Array<PylonSubscribeOptions>;
  private readonly webhookCache: ConduitClientCredentialsCache;
  private readonly workers: Array<ILindormWorker>;

  private isStarted: boolean;
  private isSetup: boolean;
  private isTeardown: boolean;

  private readonly _setup: PylonSetup | undefined;
  private readonly _teardown: PylonTeardown | undefined;

  public constructor(options: PylonOptions<H, S>) {
    this.isSetup = false;
    this.isStarted = false;
    this.isTeardown = false;
    this.webhookCache = [];

    options.environment = options.environment ?? "development";
    options.version = options.version ?? "0.0.0";
    options.domain = options.domain ?? options.amphora.domain ?? "unknown";

    this.sources = new Map(
      (options.sources ?? []).map((source) => [source.__instanceof, source]),
    );

    options.subscriptions = options.subscriptions ?? [];
    options.subscriptions.push(...calculateSubscriptions());

    options.workers = options.workers ?? [];
    options.workers.push(...calculateWorkers());

    this.options = options;

    this.logger = options.logger.child(["Pylon"], {
      domain: options.domain,
      environment: options.environment,
      name: options.name ?? "unknown",
      version: options.version,
    });

    this.amphora = options.amphora;
    this.port = options.port ?? 3000;

    this.subscriptions = options.subscriptions;

    this.workers = scanWorkers(options);

    this._setup = options.setup;
    this._teardown = options.teardown;

    this.http = new PylonHttp({
      ...options,
      amphora: this.amphora,
      logger: this.logger,
    });

    this.server = createServer(this.http.server.callback());

    this.http.loadMiddleware();

    if (options.socketListeners) {
      this.io = new PylonIo(this.server, {
        ...options,
        amphora: this.amphora,
        logger: this.logger,
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

    this.loadSources();

    if (this._setup) {
      try {
        const result = await this._setup();
        this.logger.verbose("Pylon setup done", { result });
      } catch (error: any) {
        this.logger.error("Pylon failed to setup", error);
        process.exit(1);
      }
    }

    for (const source of this.sources.values()) {
      await source.setup();
    }

    await this.subscribe();

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

    for (const source of this.sources.values()) {
      await source.disconnect();
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

  private loadSources(): void {
    if (this.options.session?.use === "stored") {
      const sessionSource = this.options.session.proteus ?? this.options.proteus;
      if (sessionSource) {
        sessionSource.addEntities([SessionEntity]);
      }
    }
  }

  private async subscribe(): Promise<void> {
    // Subscriptions are now handled by Iris WorkerQueue consume()
    // Old message bus subscription system removed in Phase 3
  }
}
