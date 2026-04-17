import { DEFAULT_TIMEOUT } from "../internal/constants/defaults";
import { ILogger } from "@lindorm/logger";
import { composeMiddleware } from "@lindorm/middleware";
import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";
import type { ZephyrAuthStrategy } from "../auth/zephyr-auth-strategy";
import { ZephyrError } from "../errors/ZephyrError";
import type {
  AuthExpiredEvent,
  AuthExpiredHandler,
  IZephyr,
  IZephyrRoom,
} from "../interfaces";
import type { ListenerEntry } from "../internal/types/listener-entry";
import { buildEnvelope } from "../internal/utils/build-envelope";
import { createZephyrContext } from "../internal/utils/create-zephyr-context";
import { dedupPromise } from "../internal/utils/dedup-promise";
import { unwrapAckResponse } from "../internal/utils/unwrap-ack-response";
import type { AppContext, ZephyrContext, ZephyrMiddleware } from "../types/context";
import type { EventIncoming, EventOutgoing, ZephyrEventMap } from "../types/event-map";
import type { AdvancedOptions, ZephyrOptions } from "../types/options";
import { ZephyrRoom } from "./ZephyrRoom";

const AUTH_EXPIRED_EVENT = "$pylon/auth/expired";

export class Zephyr<E extends ZephyrEventMap = ZephyrEventMap> implements IZephyr<E> {
  private readonly app: AppContext;
  private readonly auth: ZephyrAuthStrategy | undefined;
  private readonly autoConnect: boolean;
  private readonly autoRefreshOnExpiry: boolean;
  private readonly logger: ILogger | undefined;
  private readonly middleware: Array<ZephyrMiddleware>;
  private readonly namespace: string;
  private readonly socketOptions: AdvancedOptions;
  private readonly timeout: number;

  private socket: Socket | undefined;
  private readonly listeners: Map<string, Set<ListenerEntry>>;
  private readonly connectHandlers: Array<() => void>;
  private readonly disconnectHandlers: Array<(reason: string) => void>;
  private readonly errorHandlers: Array<(error: ZephyrError) => void>;
  private readonly reconnectHandlers: Array<(attempt: number) => void>;
  private readonly authExpiredHandlers: Set<AuthExpiredHandler>;
  private readonly refreshDedup: () => Promise<void>;

  public constructor(options: ZephyrOptions) {
    this.app = {
      alias: options.alias ?? null,
      url: options.url,
      environment: options.environment ?? null,
    };

    this.auth = options.auth;
    this.autoConnect = options.autoConnect ?? false;
    this.autoRefreshOnExpiry = options.autoRefreshOnExpiry ?? true;
    this.logger = options.logger?.child(["Zephyr"]);
    this.middleware = options.middleware ?? [];
    this.namespace = options.namespace ?? "";
    this.socketOptions = options.socketOptions ?? {};
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;

    this.listeners = new Map();
    this.connectHandlers = [];
    this.disconnectHandlers = [];
    this.errorHandlers = [];
    this.reconnectHandlers = [];
    this.authExpiredHandlers = new Set();

    this.refreshDedup = dedupPromise(() => this.performRefresh());

    if (this.autoConnect) {
      this.connect().catch((err) => this.handleError(err));
    }
  }

  public get id(): string | undefined {
    return this.socket?.id;
  }

  public get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  public async connect(): Promise<void> {
    if (this.socket?.connected) return;

    const url = `${this.app.url}${this.namespace}`;

    this.socket = io(url, {
      ...this.socketOptions,
      autoConnect: false,
    });

    if (this.auth) {
      await this.auth.prepareHandshake(this.socket);
    }

    this.wireLifecycleEvents(this.socket);
    this.registerQueuedListeners(this.socket);

    return new Promise<void>((resolve, reject) => {
      const onConnect = (): void => {
        this.socket!.off("connect_error", onError);
        resolve();
      };

      const onError = (error: Error): void => {
        this.socket!.off("connect", onConnect);
        reject(new ZephyrError(error.message, { error }));
      };

      this.socket!.once("connect", onConnect);
      this.socket!.once("connect_error", onError);
      this.socket!.connect();
    });
  }

  public async disconnect(): Promise<void> {
    if (!this.socket) return;

    if (!this.socket.connected) {
      this.socket = undefined;
      return;
    }

    return new Promise<void>((resolve) => {
      this.socket!.once("disconnect", () => {
        resolve();
      });

      this.socket!.disconnect();
    });
  }

  public async refresh(): Promise<void> {
    if (!this.auth) {
      throw new ZephyrError("No auth strategy configured", {
        code: "ZEPHYR_NO_AUTH_STRATEGY",
      });
    }

    await this.refreshDedup();
  }

  public async emit<K extends string & keyof E>(
    event: K,
    data?: EventOutgoing<E, K>,
  ): Promise<void> {
    this.assertConnected();

    const ctx = createZephyrContext({
      app: this.app,
      event,
      logger: this.logger,
      data,
    });

    await composeMiddleware<ZephyrContext>(ctx, [
      ...this.middleware,
      async (ctx): Promise<void> => {
        this.socket!.emit(event, buildEnvelope(ctx));
      },
    ]);
  }

  public async request<K extends string & keyof E>(
    event: K,
    data?: EventOutgoing<E, K>,
    options?: { timeout?: number },
  ): Promise<EventIncoming<E, K>> {
    this.assertConnected();

    const timeout = options?.timeout ?? this.timeout;

    const ctx = createZephyrContext({
      app: this.app,
      event,
      logger: this.logger,
      data,
    });

    const result = await composeMiddleware<ZephyrContext>(ctx, [
      ...this.middleware,
      async (ctx): Promise<void> => {
        const response = await this.socket!.timeout(timeout).emitWithAck(
          event,
          buildEnvelope(ctx),
        );

        unwrapAckResponse(ctx, response);
      },
    ]);

    return result.incoming.data as EventIncoming<E, K>;
  }

  public on<K extends string & keyof E>(
    event: K,
    handler: (data: EventIncoming<E, K>) => void,
  ): void {
    this.addListener(event, handler, false);
  }

  public once<K extends string & keyof E>(
    event: K,
    handler: (data: EventIncoming<E, K>) => void,
  ): void {
    this.addListener(event, handler, true);
  }

  public off<K extends string & keyof E>(
    event: K,
    handler?: (data: EventIncoming<E, K>) => void,
  ): void {
    const entries = this.listeners.get(event);
    if (!entries) return;

    if (!handler) {
      for (const entry of entries) {
        this.socket?.off(event, entry.wrapped as any);
      }
      this.listeners.delete(event);
      return;
    }

    for (const entry of entries) {
      if (entry.handler === handler) {
        this.socket?.off(event, entry.wrapped as any);
        entries.delete(entry);
        break;
      }
    }

    if (entries.size === 0) {
      this.listeners.delete(event);
    }
  }

  public room(name: string): IZephyrRoom {
    return new ZephyrRoom(this, name);
  }

  public onConnect(handler: () => void): void {
    this.connectHandlers.push(handler);
  }

  public onDisconnect(handler: (reason: string) => void): void {
    this.disconnectHandlers.push(handler);
  }

  public onError(handler: (error: ZephyrError) => void): void {
    this.errorHandlers.push(handler);
  }

  public onReconnect(handler: (attempt: number) => void): void {
    this.reconnectHandlers.push(handler);
  }

  public onAuthExpired(handler: AuthExpiredHandler): () => void {
    this.authExpiredHandlers.add(handler);
    return () => {
      this.authExpiredHandlers.delete(handler);
    };
  }

  // Private

  private async performRefresh(): Promise<void> {
    if (!this.socket) {
      throw new ZephyrError("Cannot refresh before connect", {
        code: "ZEPHYR_REFRESH_BEFORE_CONNECT",
      });
    }

    await this.auth!.refresh(this.socket);
  }

  private addListener(event: string, handler: (data: any) => void, once: boolean): void {
    const wrapped = this.wrapHandler(event, handler, once);

    const entry: ListenerEntry = { handler, wrapped, once };

    let entries = this.listeners.get(event);
    if (!entries) {
      entries = new Set();
      this.listeners.set(event, entries);
    }
    entries.add(entry);

    if (this.socket) {
      if (once) {
        this.socket.once(event, wrapped);
      } else {
        this.socket.on(event, wrapped);
      }
    }
  }

  private wrapHandler(
    event: string,
    handler: (data: any) => void,
    once: boolean,
  ): (...args: Array<any>) => void {
    return (...args: Array<any>) => {
      const serverData = args[0];

      const ctx = createZephyrContext({
        app: this.app,
        event,
        logger: this.logger,
        data: serverData,
        incoming: true,
      });

      composeMiddleware<ZephyrContext>(ctx, [
        ...this.middleware,
        async (ctx): Promise<void> => {
          handler(ctx.incoming.data);
        },
      ]).catch((err) => {
        this.handleError(err);
      });

      if (once) {
        const entries = this.listeners.get(event);
        if (entries) {
          for (const entry of entries) {
            if (entry.handler === handler) {
              entries.delete(entry);
              break;
            }
          }
          if (entries.size === 0) {
            this.listeners.delete(event);
          }
        }
      }
    };
  }

  private registerQueuedListeners(socket: Socket): void {
    for (const [event, entries] of this.listeners) {
      for (const entry of entries) {
        if (entry.once) {
          socket.once(event, entry.wrapped);
        } else {
          socket.on(event, entry.wrapped);
        }
      }
    }
  }

  private wireLifecycleEvents(socket: Socket): void {
    socket.on("connect", () => {
      for (const handler of this.connectHandlers) {
        handler();
      }
    });

    socket.on("disconnect", (reason: string) => {
      for (const handler of this.disconnectHandlers) {
        handler(reason);
      }
    });

    socket.on("connect_error", (err: Error) => {
      this.handleError(new ZephyrError(err.message, { error: err }));
    });

    socket.io.on("reconnect_attempt", () => {
      if (!this.auth) return;

      this.auth.prepareHandshake(socket).catch((err) => this.handleError(err));
    });

    socket.io.on("reconnect", (attempt: number) => {
      for (const handler of this.reconnectHandlers) {
        handler(attempt);
      }
    });

    socket.on(AUTH_EXPIRED_EVENT, (payload: AuthExpiredEvent | undefined) => {
      const event: AuthExpiredEvent = payload ?? {};

      for (const handler of this.authExpiredHandlers) {
        try {
          handler(event);
        } catch (err) {
          this.handleError(err);
        }
      }

      if (this.autoRefreshOnExpiry && this.auth) {
        this.refresh().catch((err) => this.handleError(err));
      }
    });
  }

  private handleError(err: unknown): void {
    const error =
      err instanceof ZephyrError
        ? err
        : new ZephyrError(err instanceof Error ? err.message : "Unknown error", {
            error: err instanceof Error ? err : undefined,
          });

    if (this.errorHandlers.length > 0) {
      for (const handler of this.errorHandlers) {
        handler(error);
      }
      return;
    }

    if (this.logger) {
      this.logger.error("Unhandled Zephyr error", { error });
      return;
    }
  }

  private assertConnected(): void {
    if (!this.socket?.connected) {
      throw new ZephyrError("Socket is not connected");
    }
  }
}
