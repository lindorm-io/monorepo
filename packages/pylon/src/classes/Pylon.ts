import type { IAmphora } from "@lindorm/amphora";
import type { ILogger } from "@lindorm/logger";
import type { IProteusSource } from "@lindorm/proteus";
import type { ILindormWorker } from "@lindorm/worker";
import type { Server as HttpServer } from "http";
import { createServer } from "http";
import { httpSocketIoMiddleware } from "../internal/middleware/http-socket-io-middleware.js";
import type {
  HttpCallback,
  PylonEventMap,
  PylonHttpContext,
  PylonSettings,
  PylonSetup,
  PylonSocketContext,
  PylonTeardown,
} from "../types/index.js";
import { setupAuditConsumer } from "../internal/consumers/setup-audit-consumer.js";
import { setupDataAuditConsumer } from "../internal/consumers/setup-data-audit-consumer.js";
import { setupDataAuditListeners } from "../internal/listeners/setup-data-audit-listeners.js";
import { setupWebhookDispatchConsumer } from "../internal/consumers/setup-webhook-dispatch-consumer.js";
import { setupWebhookRequestConsumer } from "../internal/consumers/setup-webhook-request-consumer.js";
import { buildAppConfig } from "../internal/utils/build-app-config.js";
import { calculateSubscriptions } from "../internal/utils/calculate-subscriptions.js";
import { calculateWorkers } from "../internal/utils/calculate-workers.js";
import { scanWorkers } from "../internal/utils/scan-workers.js";
import { stageEncryptedField } from "../internal/utils/stage-encrypted-field.js";
import { parseAuthConfig } from "../internal/utils/auth/parse-auth-config.js";
import { validateAuthSettings } from "../internal/utils/auth/validate-auth-settings.js";
import type { PylonEncKey } from "../types/index.js";
import { PylonHttp } from "./PylonHttp.js";
import { PylonIo } from "./PylonIo.js";

// The at-rest KEK selector staged onto the bare `@Encrypted()` markers when a
// deployment names none — the bootstrap key-encryption-key, shared by stored
// private keys and webhook client secrets alike (the webhook key does not
// rotate, so it needs no separate purpose). A deployment can still override
// `kryptos.encryption` / `webhook.encryption` for blast-radius separation.
const DEFAULT_KEK: PylonEncKey = { condition: { purpose: "pylon:kek" } };

export class Pylon<
  E extends PylonEventMap = PylonEventMap,
  H extends PylonHttpContext = PylonHttpContext,
  S extends PylonSocketContext = PylonSocketContext,
> {
  private readonly amphora: IAmphora;
  private readonly host: string | undefined;
  private readonly http: PylonHttp<H>;
  private readonly io: PylonIo<S> | undefined;
  private readonly logger: ILogger;
  private readonly options: PylonSettings<E, H, S>;
  private readonly port: number;
  private readonly server: HttpServer;
  private readonly workers: Array<ILindormWorker>;

  private isStarted: boolean;
  private isSetup: boolean;
  private isTeardown: boolean;

  private readonly _setup: PylonSetup | undefined;
  private readonly _teardown: PylonTeardown | undefined;

  constructor(options: PylonSettings<E, H, S>) {
    this.isSetup = false;
    this.isStarted = false;
    this.isTeardown = false;

    options.environment = options.environment ?? "development";
    options.version = options.version ?? "0.0.0";
    options.domain = options.domain ?? options.amphora.issuer ?? "unknown";

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

    // ⚠ Parsed HERE and nowhere else, for the same reason `buildAppConfig` is:
    // both transports read the driver, the refresh policy and the router prefix,
    // and two equal-but-distinct copies of one configuration is one edit away
    // from disagreeing.
    const authConfig = options.auth ? parseAuthConfig(options.auth) : undefined;

    this.http = new PylonHttp<H>(options as any, authConfig);

    if (options.socket?.enabled) {
      this.io = new PylonIo<S>(this.server, options, authConfig);
    }

    this.host = options.host;
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

    // Before anything is loaded: a driver that cannot serve the features this
    // deployment turned on must say so here, not on the first user request.
    if (this.options.auth) {
      validateAuthSettings(this.options.auth, this.logger);
    }

    await this.loadSources();

    await this.amphora.setup();

    // ⚠ Built HERE and nowhere else: after amphora has fetched, so the auth
    // driver's issuer is a memory read, and before either transport loads, so
    // both serve the SAME frozen object. Nothing in it varies per request.
    const appConfig = buildAppConfig(this.options);

    this.http.loadMiddleware(appConfig);
    await this.http.loadRouters();

    if (this.io) {
      await this.io.load(appConfig);
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

    if (this.options.cache) {
      await this.options.cache.connect();
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

    if (this.options.cache) {
      await this.options.cache.setup();
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

    if (this.options.cache) {
      await this.options.cache.disconnect();
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
    return new Promise((resolve, reject) => {
      this.server.on("request", this.http.callback);

      // A bind failure — EADDRINUSE, EACCES on a privileged port — arrives as an
      // `error` event, and an `http.Server` has no default handler for it, so
      // without this the process dies on an uncaught exception while `start()`
      // never settles. It belongs to the caller of `start()`.
      this.server.once("error", reject);

      // `host: undefined` is the WILDCARD, which is what a served container
      // wants. `listen({ port, host })` takes it as such.
      this.server.listen({ host: this.host, port: this.port }, () => {
        this.server.off("error", reject);
        resolve();
      });
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

  /**
   * The evictable source. Unset `cache` means the deployment runs ONE ephemeral
   * store, so everything evictable shares `kv` — exactly the behaviour before
   * the role existed.
   */
  private get cache(): IProteusSource | undefined {
    return this.options.cache ?? this.options.kv;
  }

  private async loadSources(): Promise<void> {
    if (this.options.auth?.session?.enabled) {
      // Authoritative: evicting a session logs the user out.
      const source = this.options.kv;
      if (source) {
        const { Session } = await import("../entities/Session.js");
        source.addEntities([Session]);
      }
    }

    if (this.options.kryptos?.enabled) {
      const source = this.options.db;
      if (source) {
        const { Kryptos } = await import("../entities/Kryptos.js");
        source.addEntities([Kryptos]);
        // Stage the KEK onto the bare `@Encrypted()` marker before setup().
        await stageEncryptedField(
          source,
          Kryptos,
          "privateKey",
          this.options.kryptos.encryption ?? DEFAULT_KEK,
        );
      }
    }

    if (this.options.queue?.enabled) {
      const source = this.options.bus;
      if (source) {
        const { Job } = await import("../messages/Job.js");
        source.addMessages([Job]);
      }
    }

    if (this.options.webhook?.enabled) {
      const proteusSource = this.options.db;
      if (proteusSource) {
        const { WebhookSubscription } =
          await import("../entities/WebhookSubscription.js");
        proteusSource.addEntities([WebhookSubscription]);
        // Stage the KEK onto the bare `@Encrypted()` markers before setup(), so
        // proteus seals the stored delivery credentials at rest and opens them
        // transparently on read. Both are live secrets under the same key.
        for (const field of ["clientSecret", "password"]) {
          await stageEncryptedField(
            proteusSource,
            WebhookSubscription,
            field,
            this.options.webhook.encryption ?? DEFAULT_KEK,
          );
        }
      }

      const irisSource = this.options.bus;
      if (irisSource) {
        const { WebhookRequest } = await import("../messages/WebhookRequest.js");
        const { WebhookDispatch } = await import("../messages/WebhookDispatch.js");
        irisSource.addMessages([WebhookRequest, WebhookDispatch]);
      }
    }

    if (this.options.responseCache?.enabled) {
      const source = this.cache;
      if (source) {
        const { CachedResponse } = await import("../entities/CachedResponse.js");
        source.addEntities([CachedResponse]);
      }
    }

    if (this.options.auth?.cache?.enabled) {
      // A cached introspection or userinfo answer is disposable by construction
      // — losing one costs a round trip, nothing more — so it lives in `cache`.
      const source = this.cache;
      if (source) {
        const encryption = this.options.auth.encryption ?? DEFAULT_KEK;

        // Stage the KEK onto each bare `@Encrypted()` marker before setup(), so
        // proteus seals the cached answer at rest and opens it transparently on
        // read. Both describe a live credential sitting in shared storage.
        // Registered per CONCERN: a deployment that turned one off gets no table
        // for it.
        if (this.options.auth.cache.introspection !== false) {
          const { CachedIntrospection } =
            await import("../entities/CachedIntrospection.js");
          source.addEntities([CachedIntrospection]);
          await stageEncryptedField(source, CachedIntrospection, "payload", encryption);
        }

        if (this.options.auth.cache.userinfo !== false) {
          const { CachedUserinfo } = await import("../entities/CachedUserinfo.js");
          source.addEntities([CachedUserinfo]);
          await stageEncryptedField(source, CachedUserinfo, "payload", encryption);
        }
      }
    }

    if (this.options.rateLimit?.enabled) {
      // A lost counter costs at most one extra allowed request, so the buckets
      // are evictable — and they are exactly the churn that must not be able to
      // push a `Session` out of `kv`.
      const source = this.cache;
      if (source) {
        const { RateLimitFixed } = await import("../entities/RateLimitFixed.js");
        const { RateLimitSliding } = await import("../entities/RateLimitSliding.js");
        const { RateLimitBucket } = await import("../entities/RateLimitBucket.js");
        source.addEntities([RateLimitFixed, RateLimitSliding, RateLimitBucket]);
      }
    }

    if (this.options.rooms?.presence) {
      // Authoritative: an evicted presence record silently drops a member from
      // a live room.
      const source = this.options.kv;
      if (source) {
        const { Presence } = await import("../entities/Presence.js");
        source.addEntities([Presence]);
      }
    }

    if (this.options.audit?.enabled) {
      const proteusSource = this.options.db;
      if (proteusSource) {
        const { RequestAuditLog } = await import("../entities/RequestAuditLog.js");
        proteusSource.addEntities([RequestAuditLog]);

        if (this.options.audit.entities?.length) {
          const { DataAuditLog } = await import("../entities/DataAuditLog.js");
          proteusSource.addEntities([DataAuditLog]);
        }
      }

      const irisSource = this.options.bus;
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
      const { bus, db } = this.options;

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
      const { bus, db } = this.options;

      if (bus && db) {
        await setupWebhookRequestConsumer(bus, db, this.logger);
        await setupWebhookDispatchConsumer(bus, db, this.logger, {
          maxErrors: this.options.webhook.maxErrors,
        });
      }
    }
  }
}
