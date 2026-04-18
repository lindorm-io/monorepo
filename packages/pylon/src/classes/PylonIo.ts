import { PylonListenerScanner } from "../internal/classes/PylonListenerScanner";
import { createCommonContextInitialisationMiddleware } from "../internal/middleware/common-context-initialisation-middleware";
import { createQueueMiddleware } from "../internal/middleware/common-queue-middleware";
import { createDependenciesMiddleware } from "../internal/middleware/common-dependencies-middleware";
import { createWebhookMiddleware } from "../internal/middleware/common-webhook-middleware";
import { createConnectionContextInitialisationMiddleware } from "../internal/middleware/connection-context-initialisation-middleware";
import { createConnectionCorsMiddleware } from "../internal/middleware/connection-cors-middleware";
import { createConnectionSessionMiddleware } from "../internal/middleware/connection-session-middleware";
import { connectionErrorHandlerMiddleware } from "../internal/middleware/connection-error-handler-middleware";
import { connectionLoggerMiddleware } from "../internal/middleware/connection-logger-middleware";
import { assertSameSiteForSockets } from "../internal/utils/config/assert-same-site-for-sockets";
import { assertSessionCookieSafeForSockets } from "../internal/utils/config/assert-session-cookie-safe-for-sockets";
import { createSocketContextInitialisationMiddleware } from "../internal/middleware/socket-context-initialisation-middleware";
import { socketErrorHandlerMiddleware } from "../internal/middleware/socket-error-handler-middleware";
import { socketLoggerMiddleware } from "../internal/middleware/socket-logger-middleware";
import { composePylonHandshakeContext } from "../internal/utils/handshake/compose-pylon-handshake-context";
import { registerAuthRefreshListener } from "../internal/utils/refresh/register-auth-refresh-listener";
import { initialisePylonSocketData } from "../internal/utils/initialise-pylon-socket-data";
import { composePylonSocketContextBase } from "../internal/utils/compose-pylon-socket-context";
import { createBuiltInRoomListeners } from "../internal/utils/create-built-in-room-listeners";
import { loadPylonListeners } from "../internal/utils/load-pylon-listener";
import { normaliseListeners } from "../internal/utils/normalise-listeners";
import { composeMiddleware } from "@lindorm/middleware";
import { isString } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import { uniq } from "@lindorm/utils";
import { useRateLimit } from "../middleware/common/use-rate-limit";
import { createAdapter } from "@socket.io/redis-adapter";
import { Server } from "http";
import { Server as SocketIoServer } from "socket.io";
import {
  IoServer,
  IoSocket,
  PylonConnectionMiddleware,
  PylonOptions,
  PylonSocket,
  PylonSocketContext,
  PylonSocketMiddleware,
} from "../types";
import { PylonListener } from "./PylonListener";

export class PylonIo<T extends PylonSocketContext = PylonSocketContext> {
  private readonly logger: ILogger;
  private readonly options: PylonOptions<any, any, T>;
  private readonly middleware: Array<PylonSocketMiddleware<T>>;

  public readonly server: IoServer;

  public constructor(http: Server, options: PylonOptions<any, any, T>) {
    assertSessionCookieSafeForSockets(options);
    assertSameSiteForSockets(options.session);

    this.logger = options.logger.child(["PylonSocket"]);

    const socket = options.socket!;

    this.middleware = [
      createDependenciesMiddleware({
        auditConfig:
          options.audit?.enabled && (options.audit.iris ?? options.iris)
            ? {
                iris: options.audit.iris ?? options.iris!,
                actor: options.audit.actor,
                sanitise: options.audit.sanitise,
                skip: options.audit.skip,
              }
            : undefined,
        hermes: options.hermes,
        iris: options.iris,
        proteus: options.proteus,
        rateLimitProteus: options.rateLimit?.enabled
          ? (options.rateLimit.proteus ?? options.proteus)
          : undefined,
        roomsEnabled: !!options.rooms,
        roomsPresence: options.rooms?.presence,
        roomsProteus: options.rooms?.presence
          ? (options.rooms.proteus ?? options.proteus)
          : undefined,
      }),
      createQueueMiddleware(options.queue),
      createWebhookMiddleware(options.webhook),
      ...(options.rateLimit?.enabled && options.rateLimit.window && options.rateLimit.max
        ? [
            useRateLimit({
              window: options.rateLimit.window,
              max: options.rateLimit.max,
              strategy: options.rateLimit.strategy,
              key: options.rateLimit.key,
              skip: options.rateLimit.skip,
            }),
          ]
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

  public use(middleware: Array<PylonSocketMiddleware<T>>): void {
    this.addMiddleware(middleware);
  }

  public load(): void {
    this.logger.verbose("Loading listeners");

    const listeners: Array<PylonListener<T>> = [];
    const namespaces: Array<string> = [];

    const socketListeners = normaliseListeners(this.options.socket?.listeners);

    if (socketListeners.length) {
      const scanner = new PylonListenerScanner<T>(this.logger);

      for (const entry of socketListeners) {
        if (isString(entry)) {
          const result = scanner.scan(entry);

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
      ...(this.options.session
        ? [createConnectionSessionMiddleware(this.options.session)]
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
      ...initialisePylonSocketData(this.options),
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
        ...initialisePylonSocketData(this.options),
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
