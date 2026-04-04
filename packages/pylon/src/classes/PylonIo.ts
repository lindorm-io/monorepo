import { PylonListenerScanner } from "#internal/classes/PylonListenerScanner";
import { createCommonContextInitialisationMiddleware } from "#internal/middleware/common-context-initialisation-middleware";
import { createQueueMiddleware } from "#internal/middleware/common-queue-middleware";
import { createSourcesMiddleware } from "#internal/middleware/common-sources-middleware";
import { createWebhookMiddleware } from "#internal/middleware/common-webhook-middleware";
import { createSocketContextInitialisationMiddleware } from "#internal/middleware/socket-context-initialisation-middleware";
import { socketErrorHandlerMiddleware } from "#internal/middleware/socket-error-handler-middleware";
import { socketLoggerMiddleware } from "#internal/middleware/socket-logger-middleware";
import { initialisePylonSocketData } from "#internal/utils/initialise-pylon-socket-data";
import { composePylonSocketContextBase } from "#internal/utils/compose-pylon-socket-context";
import { loadPylonListeners } from "#internal/utils/load-pylon-listener";
import { composeMiddleware } from "@lindorm/middleware";
import { isArray, isString } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import { uniq } from "@lindorm/utils";
import { useRateLimit } from "../middleware/common/use-rate-limit";
import { createAdapter } from "@socket.io/redis-adapter";
import { Server } from "http";
import { Server as SocketIoServer } from "socket.io";
import {
  IoServer,
  IoSocket,
  PylonIoOptions,
  PylonSocket,
  PylonSocketContext,
  PylonSocketMiddleware,
} from "../types";
import { PylonListener } from "./PylonListener";

export class PylonIo<T extends PylonSocketContext = PylonSocketContext> {
  private readonly logger: ILogger;
  private readonly options: PylonIoOptions<T>;
  private readonly middleware: Array<PylonSocketMiddleware<T>>;

  public readonly server: IoServer;

  public constructor(http: Server, options: PylonIoOptions<T>) {
    this.logger = options.logger.child(["PylonSocket"]);

    this.middleware = [
      createSourcesMiddleware({
        hermes: options.hermes,
        iris: options.iris,
        proteus: options.proteus,
        rateLimitProteus: options.rateLimit?.enabled
          ? (options.rateLimit.proteus ?? options.proteus)
          : undefined,
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
    ];
    this.options = options;
    this.server = new SocketIoServer(http, {
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
  }

  // public

  public use(middleware: Array<PylonSocketMiddleware<T>>): void {
    this.addMiddleware(middleware);
  }

  public load(): void {
    this.logger.verbose("Loading listeners");

    const listeners: Array<PylonListener<T>> = [];
    const namespaces: Array<string> = [];

    if (isString(this.options.socketListeners)) {
      const scanner = new PylonListenerScanner<T>(this.logger);
      const result = scanner.scan(this.options.socketListeners);

      listeners.push(...result.listeners);
      namespaces.push(...result.namespaces);
    } else if (isArray(this.options.socketListeners)) {
      for (const listener of this.options.socketListeners) {
        listeners.push(listener);

        if (listener.namespace) {
          namespaces.push(listener.namespace);
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

    const stdListeners = listeners.filter((listener) => !listener.namespace);

    this.logger.debug("Creating connection handler", { listeners: stdListeners });

    this.server.on("connection", (socket) => {
      this.createSocketConnectionHandler(this.server, socket, middleware, stdListeners);
    });

    for (const namespace of uniq(namespaces)) {
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

  private createSocketConnectionHandler(
    io: IoServer,
    socket: IoSocket,
    middleware: Array<PylonSocketMiddleware<T>>,
    listeners: Array<PylonListener<T>>,
  ): void {
    socket.data = {
      ...socket.data,
      ...initialisePylonSocketData(this.options),
    };

    const disconnectListeners = listeners.filter((l) =>
      l.listeners.some((item) => item.event === "disconnect"),
    );

    const eventListeners = listeners.filter(
      (l) => !l.listeners.every((item) => item.event === "disconnect"),
    );

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
