import { isArray, isString } from "@lindorm/is";
import { ILogger } from "@lindorm/logger";
import { uniq } from "@lindorm/utils";
import { createAdapter } from "@socket.io/redis-adapter";
import { Server } from "http";
import { Server as SocketIoServer } from "socket.io";
import {
  createEventContextInitialisationMiddleware,
  createSourcesMiddleware,
  eventErrorHandlerMiddleware,
  eventLoggerMiddleware,
} from "../middleware/private";
import {
  IoServer,
  IoSocket,
  PylonIoOptions,
  PylonSocket,
  PylonSocketContext,
  PylonSocketMiddleware,
} from "../types";
import { initialisePylonSocketData, loadPylonListeners } from "../utils/private";
import { PylonListenerScanner } from "./private";
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
        entities: options.entities,
        messages: options.messages,
        sources: options.sources,
      }),
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
      createEventContextInitialisationMiddleware({
        amphora: this.options.amphora,
        logger: this.logger,
      }),
      eventLoggerMiddleware,
      eventErrorHandlerMiddleware,
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
    socket.data = initialisePylonSocketData(this.options);

    loadPylonListeners(io, socket as PylonSocket, middleware, listeners);

    socket.on("disconnect", () => {
      this.logger.verbose("Socket disconnected", { socket: socket.id });
    });
  }
}
