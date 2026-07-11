import type { IAmphora } from "@lindorm/amphora";
import type { ILogger } from "@lindorm/logger";
import type { ILindormWorker } from "@lindorm/worker";
import type { Server as HttpServer } from "http";
import { createServer } from "http";
import { httpSocketIoMiddleware } from "../internal/middleware/http-socket-io-middleware.js";
import type {
  HttpCallback,
  PylonEventMap,
  PylonHttpContext,
  PylonOptions,
  PylonSetup,
  PylonSocketContext,
  PylonTeardown,
} from "../types/index.js";
import { setupAuditConsumer } from "../internal/consumers/setup-audit-consumer.js";
import { setupDataAuditConsumer } from "../internal/consumers/setup-data-audit-consumer.js";
import { setupDataAuditListeners } from "../internal/listeners/setup-data-audit-listeners.js";
import { setupWebhookDispatchConsumer } from "../internal/consumers/setup-webhook-dispatch-consumer.js";
import { setupWebhookRequestConsumer } from "../internal/consumers/setup-webhook-request-consumer.js";
import { calculateSubscriptions } from "../internal/utils/calculate-subscriptions.js";
import { calculateWorkers } from "../internal/utils/calculate-workers.js";
import { scanWorkers } from "../internal/utils/scan-workers.js";
import { PylonHttp } from "./PylonHttp.js";
import { PylonIo } from "./PylonIo.js";

export class Pylon<
  E extends PylonEventMap = PylonEventMap,
  H extends PylonHttpContext = PylonHttpContext,
  S extends PylonSocketContext = PylonSocketContext,
> {
  private readonly amphora: IAmphora;
  private readonly http: PylonHttp<H>;
  private readonly io: PylonIo<S> | undefined;
  private readonly logger: ILogger;
  private readonly options: PylonOptions<E, H, S>;
  private readonly port: number;
  private readonly server: HttpServer;
  private readonly workers: Array<ILindormWorker>;

  private isStarted: boolean;
  private isSetup: boolean;
  private isTeardown: boolean;

  private readonly _setup: PylonSetup | undefined;
  private readonly _teardown: PylonTeardown | undefined;

  constructor(options: PylonOptions<E, H, S>) {
    this.isSetup = false;
    this.isStarted = false;
    this.isTeardown = false;

    options.environment = options.environment ?? "development";
    options.version = options.version ?? "0.0.0";
    options.domain = options.domain ?? options.amphora.domain ?? "unknown";

    options.subscriptions = options.subscriptions ?? [];
    options.subscriptions.push(...calculateSubscriptions());

    const workers = options.workers;
    options.workers = Array.isArray(workers) ? workers : workers ? [workers] : [];
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

  get callback(): HttpCallback {
    return this.http.callback;
  }

  async setup(): Promise<void> {
    if (this.isSetup) return;

    this.logger.verbose("Pylon setup");

    await this.loadSources();

    await this.amphora.setup();

    this.http.loadMiddleware();
    await this.http.loadRouters();

    if (this.io) {
      await this.io.load();
      this.http.server.use(httpSocketIoMiddleware(this.io.server));
    }

    const workers = await scanWorkers(this.options);
    this.workers.push(...workers);

    // Connect the supplied sources before the user setup callback so it (and the
    // source setup below) can use them — the mirror of teardown, which
    // disconnects after the user teardown callback. connect() is idempotent.
    if (this.options.db) {
      await this.options.db.connect();
    }

    if (this.options.kv) {
      await this.options.kv.connect();
    }

    if (this.options.bus) {
      await this.options.bus.connect();
    }

    if (this._setup) {
      try {
        const result = await this._setup();
        this.logger.verbose("Pylon setup done", { result });
      } catch (error: any) {
        this.logger.error("Pylon failed to setup", error);
        process.exit(1);
      }
    }

    if (this.options.db) {
      await this.options.db.setup();
    }

    if (this.options.kv) {
      await this.options.kv.setup();
    }

    if (this.options.bus) {
      await this.options.bus.setup();
    }

    await this.subscribe();

    this.isSetup = true;
    this.isTeardown = false;
  }

  async start(): Promise<void> {
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

  async stop(): Promise<void> {
    if (!this.isStarted) return;

    this.logger.verbose("Pylon stopping");

    await this.close();
    await this.teardown();

    for (const worker of this.workers) {
      await worker.stop();
    }

    this.isStarted = false;

    this.logger.info("Pylon stopped");

    process.removeListener("SIGINT", this.handleSignal.bind(this, "SIGINT"));
    process.removeListener("SIGTERM", this.handleSignal.bind(this, "SIGTERM"));
  }

  async teardown(): Promise<void> {
    if (!this._teardown) return;
    if (this.isTeardown) return;

    if (this._teardown) {
      const result = await this._teardown();
      this.logger.verbose("Pylon teardown", { result });
    }

    if (this.options.bus) {
      await this.options.bus.disconnect();
    }

    if (this.options.db) {
      await this.options.db.disconnect();
    }

    if (this.options.kv) {
      await this.options.kv.disconnect();
    }

    this.isSetup = false;
    this.isTeardown = true;
  }

  async work(): Promise<void> {
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

  private async loadSources(): Promise<void> {
    if (this.options.session?.enabled) {
      const source = this.options.session.kv ?? this.options.kv;
      if (source) {
        const { Session } = await import("../entities/Session.js");
        source.addEntities([Session]);
      }
    }

    if (this.options.kryptos?.enabled) {
      const source = this.options.kryptos.db ?? this.options.db;
      if (source) {
        const { Kryptos } = await import("../entities/Kryptos.js");
        source.addEntities([Kryptos]);
      }
    }

    if (this.options.queue?.enabled) {
      const source = this.options.queue.bus ?? this.options.bus;
      if (source) {
        const { Job } = await import("../messages/Job.js");
        source.addMessages([Job]);
      }
    }

    if (this.options.webhook?.enabled) {
      const proteusSource = this.options.webhook.db ?? this.options.db;
      if (proteusSource) {
        const { WebhookSubscription } =
          await import("../entities/WebhookSubscription.js");
        proteusSource.addEntities([WebhookSubscription]);
      }

      const irisSource = this.options.webhook.bus ?? this.options.bus;
      if (irisSource) {
        const { WebhookRequest } = await import("../messages/WebhookRequest.js");
        const { WebhookDispatch } = await import("../messages/WebhookDispatch.js");
        irisSource.addMessages([WebhookRequest, WebhookDispatch]);
      }
    }

    if (this.options.cache?.enabled) {
      const source = this.options.cache.kv ?? this.options.kv;
      if (source) {
        const { CachedResponse } = await import("../entities/CachedResponse.js");
        source.addEntities([CachedResponse]);
      }
    }

    if (this.options.rateLimit?.enabled) {
      const source = this.options.rateLimit.kv ?? this.options.kv;
      if (source) {
        const { RateLimitFixed } = await import("../entities/RateLimitFixed.js");
        const { RateLimitSliding } = await import("../entities/RateLimitSliding.js");
        const { RateLimitBucket } = await import("../entities/RateLimitBucket.js");
        source.addEntities([RateLimitFixed, RateLimitSliding, RateLimitBucket]);
      }
    }

    if (this.options.rooms?.presence) {
      const source = this.options.rooms.kv ?? this.options.kv;
      if (source) {
        const { Presence } = await import("../entities/Presence.js");
        source.addEntities([Presence]);
      }
    }

    if (this.options.audit?.enabled) {
      const proteusSource = this.options.audit.db ?? this.options.db;
      if (proteusSource) {
        const { RequestAuditLog } = await import("../entities/RequestAuditLog.js");
        proteusSource.addEntities([RequestAuditLog]);

        if (this.options.audit.entities?.length) {
          const { DataAuditLog } = await import("../entities/DataAuditLog.js");
          proteusSource.addEntities([DataAuditLog]);
        }
      }

      const irisSource = this.options.audit.bus ?? this.options.bus;
      if (irisSource) {
        const { RequestAudit } = await import("../messages/RequestAudit.js");
        irisSource.addMessages([RequestAudit]);

        if (this.options.audit.entities?.length) {
          const { DataAuditChange } = await import("../messages/DataAuditChange.js");
          irisSource.addMessages([DataAuditChange]);
        }
      }
    }
  }

  private async subscribe(): Promise<void> {
    if (this.options.audit?.enabled) {
      const bus = this.options.audit.bus ?? this.options.bus;
      const db = this.options.audit.db ?? this.options.db;

      if (bus && db) {
        await setupAuditConsumer(bus, db, this.logger);

        if (this.options.audit.entities?.length) {
          await setupDataAuditListeners(
            db,
            bus,
            this.options.audit.entities,
            this.logger,
          );
          await setupDataAuditConsumer(bus, db, this.logger);
        }
      }
    }

    if (this.options.webhook?.enabled) {
      const bus = this.options.webhook.bus ?? this.options.bus;
      const db = this.options.webhook.db ?? this.options.db;

      if (bus && db) {
        await setupWebhookRequestConsumer(bus, db, this.logger);
        await setupWebhookDispatchConsumer(bus, db, this.logger, {
          encryptionKey: this.options.webhook.encryptionKey,
          maxErrors: this.options.webhook.maxErrors,
        });
      }
    }
  }
}
