import { IAmphora } from "@lindorm/amphora";
import { ILogger } from "@lindorm/logger";
import { ILindormWorker } from "@lindorm/worker";
import { Server as HttpServer, createServer } from "http";
import { httpSocketIoMiddleware } from "#internal/middleware/http-socket-io-middleware";
import {
  HttpCallback,
  PylonHttpContext,
  PylonOptions,
  PylonSetup,
  PylonSocketContext,
  PylonTeardown,
} from "../types";
import {
  DataAuditLog,
  Kryptos,
  Presence,
  RateLimitBucket,
  RateLimitFixed,
  RateLimitSliding,
  RequestAuditLog,
  Session,
  WebhookSubscription,
} from "../entities";
import {
  DataAuditChange,
  Job,
  RequestAudit,
  WebhookDispatch,
  WebhookRequest,
} from "../messages";
import { setupAuditConsumer } from "#internal/consumers/setup-audit-consumer";
import { setupDataAuditConsumer } from "#internal/consumers/setup-data-audit-consumer";
import { setupDataAuditListeners } from "#internal/listeners/setup-data-audit-listeners";
import { setupWebhookDispatchConsumer } from "#internal/consumers/setup-webhook-dispatch-consumer";
import { setupWebhookRequestConsumer } from "#internal/consumers/setup-webhook-request-consumer";
import { calculateSubscriptions } from "#internal/utils/calculate-subscriptions";
import { calculateWorkers } from "#internal/utils/calculate-workers";
import { scanWorkers } from "#internal/utils/scan-workers";
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

    options.environment = options.environment ?? "development";
    options.version = options.version ?? "0.0.0";
    options.domain = options.domain ?? options.amphora.domain ?? "unknown";

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

    this.server = createServer();
    this.http = new PylonHttp<H>(options as any);

    if (options.socket?.enabled) {
      this.io = new PylonIo<S>(this.server, options);
    }

    this.port = options.port ?? 3000;

    this._setup = options.setup;
    this._teardown = options.teardown;
    this.workers = [];
  }

  // public

  public get callback(): HttpCallback {
    return this.http.callback;
  }

  public async setup(): Promise<void> {
    if (this.isSetup) return;

    this.logger.verbose("Pylon setup");

    this.loadSources();

    await this.amphora.setup();

    this.http.loadMiddleware();
    this.http.loadRouters();

    if (this.io) {
      this.io.load();
      this.http.server.use(httpSocketIoMiddleware(this.io.server));
    }

    const workers = scanWorkers(this.options);
    this.workers.push(...workers);

    if (this._setup) {
      try {
        const result = await this._setup();
        this.logger.verbose("Pylon setup done", { result });
      } catch (error: any) {
        this.logger.error("Pylon failed to setup", error);
        process.exit(1);
      }
    }

    if (this.options.proteus) {
      await this.options.proteus.setup();
    }

    if (this.options.iris) {
      await this.options.iris.setup();
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

    if (this.options.iris) {
      await this.options.iris.disconnect();
    }

    if (this.options.proteus) {
      await this.options.proteus.disconnect();
    }

    this.isSetup = false;
    this.isTeardown = true;
  }

  public async work(): Promise<void> {
    if (this.isStarted) return;

    this.logger.verbose("Pylon working");

    await this.setup();

    for (const worker of this.workers) {
      worker.start();
    }
  }

  // private

  private listen(): Promise<void> {
    return new Promise((resolve) => {
      this.server.on("request", this.http.callback);
      this.server.listen(this.port, resolve);
    });
  }

  private close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private handleSignal(signal: string): void {
    this.logger.info("Received signal", { signal });
    void this.stop();

    setTimeout(() => {
      this.logger.warn("Forcing shutdown due to timeout");
      process.exit(1);
    }, 10000).unref();
  }

  private loadSources(): void {
    if (this.options.session?.enabled) {
      const source = this.options.session.proteus ?? this.options.proteus;
      if (source) {
        source.addEntities([Session]);
      }
    }

    if (this.options.kryptos?.enabled) {
      const source = this.options.kryptos.proteus ?? this.options.proteus;
      if (source) {
        source.addEntities([Kryptos]);
      }
    }

    if (this.options.queue?.enabled) {
      const source = this.options.queue.iris ?? this.options.iris;
      if (source) {
        source.addMessages([Job]);
      }
    }

    if (this.options.webhook?.enabled) {
      const proteusSource = this.options.webhook.proteus ?? this.options.proteus;
      if (proteusSource) {
        proteusSource.addEntities([WebhookSubscription]);
      }

      const irisSource = this.options.webhook.iris ?? this.options.iris;
      if (irisSource) {
        irisSource.addMessages([WebhookRequest, WebhookDispatch]);
      }
    }

    if (this.options.rateLimit?.enabled) {
      const source = this.options.rateLimit.proteus ?? this.options.proteus;
      if (source) {
        source.addEntities([RateLimitFixed, RateLimitSliding, RateLimitBucket]);
      }
    }

    if (this.options.rooms?.presence) {
      const source = this.options.rooms.proteus ?? this.options.proteus;
      if (source) {
        source.addEntities([Presence]);
      }
    }

    if (this.options.audit?.enabled) {
      const proteusSource = this.options.audit.proteus ?? this.options.proteus;
      if (proteusSource) {
        proteusSource.addEntities([RequestAuditLog]);

        if (this.options.audit.entities?.length) {
          proteusSource.addEntities([DataAuditLog]);
        }
      }

      const irisSource = this.options.audit.iris ?? this.options.iris;
      if (irisSource) {
        irisSource.addMessages([RequestAudit]);

        if (this.options.audit.entities?.length) {
          irisSource.addMessages([DataAuditChange]);
        }
      }
    }
  }

  private async subscribe(): Promise<void> {
    if (this.options.audit?.enabled) {
      const iris = this.options.audit.iris ?? this.options.iris;
      const proteus = this.options.audit.proteus ?? this.options.proteus;

      if (iris && proteus) {
        await setupAuditConsumer(iris, proteus, this.logger);

        if (this.options.audit.entities?.length) {
          setupDataAuditListeners(
            proteus,
            iris,
            this.options.audit.actor,
            this.options.audit.entities,
            this.logger,
          );
          await setupDataAuditConsumer(iris, proteus, this.logger);
        }
      }
    }

    if (this.options.webhook?.enabled) {
      const iris = this.options.webhook.iris ?? this.options.iris;
      const proteus = this.options.webhook.proteus ?? this.options.proteus;

      if (iris && proteus) {
        await setupWebhookRequestConsumer(iris, proteus, this.logger);
        await setupWebhookDispatchConsumer(iris, this.logger, {
          encryptionKey: this.options.webhook.encryptionKey,
        });
      }
    }
  }
}
