import { PylonListenerScanner } from "../internal/classes/PylonListenerScanner.js";
import { createCommonContextInitialisationMiddleware } from "../internal/middleware/common-context-initialisation-middleware.js";
import { createQueueMiddleware } from "../internal/middleware/common-queue-middleware.js";
import { createDependenciesMiddleware } from "../internal/middleware/common-dependencies-middleware.js";
import { createWebhookMiddleware } from "../internal/middleware/common-webhook-middleware.js";
import { createConnectionContextInitialisationMiddleware } from "../internal/middleware/connection-context-initialisation-middleware.js";
import { createConnectionCorsMiddleware } from "../internal/middleware/connection-cors-middleware.js";
import { createConnectionSessionMiddleware } from "../internal/middleware/connection-session-middleware.js";
import { connectionErrorHandlerMiddleware } from "../internal/middleware/connection-error-handler-middleware.js";
import { connectionLoggerMiddleware } from "../internal/middleware/connection-logger-middleware.js";
import { assertSameSiteForSockets } from "../internal/utils/config/assert-same-site-for-sockets.js";
import { assertSessionCookieSafeForSockets } from "../internal/utils/config/assert-session-cookie-safe-for-sockets.js";
import { createSocketContextInitialisationMiddleware } from "../internal/middleware/socket-context-initialisation-middleware.js";
import { socketErrorHandlerMiddleware } from "../internal/middleware/socket-error-handler-middleware.js";
import { socketLoggerMiddleware } from "../internal/middleware/socket-logger-middleware.js";
import { composePylonHandshakeContext } from "../internal/utils/handshake/compose-pylon-handshake-context.js";
import { registerAuthRefreshListener } from "../internal/utils/refresh/register-auth-refresh-listener.js";
import { initialisePylonSocketData } from "../internal/utils/initialise-pylon-socket-data.js";
import { buildAppConfig } from "../internal/utils/build-app-config.js";
import { parseAuthConfig } from "../internal/utils/auth/parse-auth-config.js";
import { composePylonSocketContextBase } from "../internal/utils/compose-pylon-socket-context.js";
import { createBuiltInRoomListeners } from "../internal/utils/create-built-in-room-listeners.js";
import { loadPylonListeners } from "../internal/utils/load-pylon-listener.js";
import { normaliseListeners } from "../internal/utils/normalise-listeners.js";
import { composeMiddleware } from "@lindorm/middleware";
import { isString } from "@lindorm/is";
import type { ILogger } from "@lindorm/logger";
import { uniq } from "@lindorm/utils";
import { useRateLimit } from "../middleware/common/use-rate-limit.js";
import { createAdapter } from "@socket.io/redis-adapter";
import type { Server } from "http";
import { Server as SocketIoServer } from "socket.io";
import type {
  AppConfig,
  IoServer,
  IoSocket,
  PylonConnectionMiddleware,
  PylonSettings,
  PylonSocket,
  PylonSocketContext,
  PylonSocketData,
  PylonSocketMiddleware,
} from "../types/index.js";
import { PylonListener } from "./PylonListener.js";

export class PylonIo<T extends PylonSocketContext = PylonSocketContext> {
  private readonly logger: ILogger;
  private readonly options: PylonSettings<any, any, T>;
  private readonly middleware: Array<PylonSocketMiddleware<T>>;

  readonly server: IoServer;

  constructor(http: Server, options: PylonSettings<any, any, T>) {
    assertSessionCookieSafeForSockets(options);
    assertSameSiteForSockets(options.auth?.session);

    this.logger = options.logger.child(["PylonSocket"]);

    const socket = options.socket!;

    // The evictable source — `cache`, or `kv` when the deployment runs one store.
    const cache = options.cache ?? options.kv;

    this.middleware = [
      createDependenciesMiddleware({
        actor: options.actor,
        // The socket transport resolves claims too — the handshake authenticates
        // a credential and `ctx.auth.introspect()` answers for it — so it gets
        // the same parsed auth config the http transport does.
        authConfig: options.auth ? parseAuthConfig(options.auth) : undefined,
        hermes: options.hermes,
        bus: options.bus,
        cache,
        kv: options.kv,
        db: options.db,
        roomsEnabled: !!options.rooms,
        roomsPresence: options.rooms?.presence,
      }),
      createQueueMiddleware(options.queue),
      createWebhookMiddleware(options.webhook),
      // No arguments: the deployment's rate-limit policy is on
      // `ctx.state.app.config.rateLimit`, which reaches this transport too.
      ...(options.rateLimit?.enabled && options.rateLimit.window && options.rateLimit.max
        ? [useRateLimit()]
        : []),
      ...(socket.middleware ?? []),
    ];
    this.options = options;
    this.server = new SocketIoServer(http, {
      ...(socket.options ?? {}),
      ...(socket.redis
        ? {
            adapter: createAdapter(socket.redis.duplicate(), socket.redis.duplicate()),
          }
        : {}),
    });
  }

  // public

  use(middleware: Array<PylonSocketMiddleware<T>>): void {
    this.addMiddleware(middleware);
  }

  /**
   * ⚠ `appConfig` is handed in by `Pylon`, which builds it ONCE after
   * `amphora.setup()` and gives the SAME frozen object to both transports. It
   * falls back to building its own only for a `PylonIo` driven standalone.
   */
  async load(appConfig?: AppConfig): Promise<void> {
    if (this._loaded) return this._loaded;
    if (appConfig) this.appConfig = appConfig;
    this._loaded = this.loadOnce();
    return this._loaded;
  }

  private _loaded: Promise<void> | null = null;
  private appConfig: AppConfig | null = null;

  /** Built at most once per process, never per connection. */
  private get resolvedAppConfig(): AppConfig {
    return (this.appConfig ??= buildAppConfig(this.options));
  }

  /**
   * The socket's ambient identity plus the deployment's policy. ⚠ `config` is
   * the SAME frozen object on every connection — only the surrounding data
   * (tokens, session, the pylon namespace) is per-socket.
   */
  private buildSocketData(): PylonSocketData {
    return initialisePylonSocketData({
      config: this.resolvedAppConfig,
      domain: this.options.domain,
      environment: this.options.environment,
      name: this.options.name,
      version: this.options.version,
    });
  }

  private async loadOnce(): Promise<void> {
    this.logger.verbose("Loading listeners");

    const listeners: Array<PylonListener<T>> = [];
    const namespaces: Array<string> = [];

    const socketListeners = normaliseListeners(this.options.socket?.listeners);

    if (socketListeners.length) {
      const scanner = new PylonListenerScanner<T>(this.logger);

      for (const entry of socketListeners) {
        if (isString(entry)) {
          const result = await scanner.scan(entry);

          listeners.push(...result.listeners);
          namespaces.push(...result.namespaces);
        } else {
          listeners.push(entry);

          if (entry.namespace) {
            namespaces.push(entry.namespace);
          }
        }
      }
    }

    if (this.options.rooms) {
      const builtIn = createBuiltInRoomListeners<T>();

      const userSegmentKeys = new Set<string>();
      for (const l of listeners) {
        for (const item of l.listeners) {
          if (item.segments) {
            userSegmentKeys.add(
              item.segments
                .map((s) => (s.type === "literal" ? s.value : `{${s.type}}`))
                .join(":"),
            );
          }
        }
      }

      for (const bl of builtIn) {
        const filtered = bl.listeners.filter((item) => {
          if (!item.segments) return true;
          const key = item.segments
            .map((s) => (s.type === "literal" ? s.value : `{${s.type}}`))
            .join(":");
          return !userSegmentKeys.has(key);
        });

        if (filtered.length > 0) {
          const filteredListener = new PylonListener<T>();
          for (const item of filtered) {
            filteredListener._addScannedListener(
              item.event,
              item.method,
              item.segments!,
              item.listeners,
            );
          }
          listeners.push(filteredListener);
        }
      }
    }

    const middleware = [
      socketErrorHandlerMiddleware,
      createSocketContextInitialisationMiddleware(this.logger),
      createCommonContextInitialisationMiddleware(this.options.amphora),
      socketLoggerMiddleware,
      ...(this.middleware ?? []),
    ];

    const connectionMiddleware: Array<PylonConnectionMiddleware> = [
      connectionErrorHandlerMiddleware,
      createConnectionContextInitialisationMiddleware(this.logger),
      createCommonContextInitialisationMiddleware(this.options.amphora),
      ...(this.options.cors ? [createConnectionCorsMiddleware(this.options.cors)] : []),
      ...(this.options.auth?.session
        ? [
            createConnectionSessionMiddleware(
              this.options.kv,
              this.options.auth.session,
              this.options.cookies,
            ),
          ]
        : []),
      connectionLoggerMiddleware,
      ...((this.options.socket?.connectionMiddleware ??
        []) as Array<PylonConnectionMiddleware>),
    ];

    const stdListeners = listeners.filter((listener) => !listener.namespace);
    const uniqueNamespaces = uniq(namespaces);
    const allNamespaces = ["/", ...uniqueNamespaces];

    for (const ns of allNamespaces) {
      this.server.of(ns).use((socket, next) => {
        this.runConnectionChain(socket, connectionMiddleware)
          .then(() => next())
          .catch((err: Error) => next(err));
      });
    }

    this.logger.debug("Creating connection handler", { listeners: stdListeners });

    this.server.on("connection", (socket) => {
      this.createSocketConnectionHandler(this.server, socket, middleware, stdListeners);
    });

    for (const namespace of uniqueNamespaces) {
      const nsListeners = listeners.filter(
        (listener) => listener.namespace === namespace,
      );

      this.logger.debug("Creating namespace connection handler", {
        namespace,
        listeners: nsListeners,
      });

      this.server.of(namespace).on("connection", (socket) => {
        this.createSocketConnectionHandler(this.server, socket, middleware, nsListeners);
      });
    }

    this.logger.info("Listeners loaded");
  }

  // private

  private addMiddleware(middleware: Array<PylonSocketMiddleware<T>>): void {
    for (const mw of middleware) {
      this.logger.debug("Adding middleware", {
        middleware: mw.name ?? mw.constructor.name,
      });
      this.middleware.push(mw);
    }
  }

  private async runConnectionChain(
    socket: IoSocket,
    middleware: Array<PylonConnectionMiddleware>,
  ): Promise<void> {
    socket.data = {
      ...socket.data,
      ...this.buildSocketData(),
    };

    const ctx = composePylonHandshakeContext(this.server, socket as PylonSocket);

    await composeMiddleware<any>(ctx, middleware, { useClone: false });
  }

  private createSocketConnectionHandler(
    io: IoServer,
    socket: IoSocket,
    middleware: Array<PylonSocketMiddleware<T>>,
    listeners: Array<PylonListener<T>>,
  ): void {
    if (!socket.data?.app) {
      socket.data = {
        ...socket.data,
        ...this.buildSocketData(),
      };
    }

    const disconnectListeners = listeners.filter((l) =>
      l.listeners.some((item) => item.event === "disconnect"),
    );

    const eventListeners = listeners.filter(
      (l) => !l.listeners.every((item) => item.event === "disconnect"),
    );

    registerAuthRefreshListener(socket as PylonSocket, this.logger);

    loadPylonListeners(io, socket as PylonSocket, middleware, eventListeners);

    socket.on("disconnect", async (reason) => {
      this.logger.verbose("Socket disconnected", { socket: socket.id, reason });

      if (!disconnectListeners.length) return;

      const ctx = composePylonSocketContextBase(io, socket as PylonSocket, {
        args: [{ reason }],
        event: "disconnect",
      });

      const disconnectMiddleware: Array<PylonSocketMiddleware<T>> = [];

      for (const listener of disconnectListeners) {
        for (const item of listener.listeners) {
          if (item.event === "disconnect") {
            disconnectMiddleware.push(...listener.middleware, ...item.listeners);
          }
        }
      }

      try {
        await composeMiddleware<any>(ctx, [...middleware, ...disconnectMiddleware], {
          useClone: false,
        });
      } catch (err: any) {
        this.logger.error("Error in disconnect handler", err);
      }
    });
  }
}
