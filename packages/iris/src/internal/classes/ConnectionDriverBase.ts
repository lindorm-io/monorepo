import { EventEmitter } from "node:events";
import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IIrisDriver } from "../../interfaces/IrisDriver.js";
import type {
  IIrisMessageBus,
  IIrisPublisher,
  IIrisRpcClient,
  IIrisRpcServer,
  IIrisStreamProcessor,
  IIrisWorkerQueue,
  IMessage,
  IMessageSubscriber,
} from "../../interfaces/index.js";
import type {
  DeadLetterEntry,
  DeadLetterFilterOptions,
  DeadLetterListOptions,
  IrisCapabilities,
  IrisConnectionState,
  IrisDriverType,
  IrisEvents,
  IrisHookMeta,
} from "../../types/index.js";
import type { MessageEncryptionContext } from "../message/types/encryption-context.js";
import type { DriverBaseOptions } from "./DriverBase.js";

export type ConnectionDriverBaseOptions = {
  /** The active driver type — stamped onto every pattern instance the factories create. */
  driverType: IrisDriverType;
  /** Logger label for the driver's child logger (e.g. `"RedisDriver"`). */
  loggerLabel: string;
  logger: ILogger;
  meta?: IrisHookMeta;
  encryption?: MessageEncryptionContext;
  getSubscribers: () => Array<IMessageSubscriber>;
};

/**
 * The connection lifecycle shared by every `*Driver`. Owns the parts that were
 * byte-identical across all five brokers — the event emitter, the connection
 * state machine, the concurrent-`connect()` guard (M13a), the reply-queue flag,
 * the `drain()` poll-loop, the reconnect re-register scaffolding (M13b), and the
 * six `create*` factory wrappers — behind abstract hooks for the genuinely
 * broker-specific bits (`doConnect`, `disconnect`, the per-factory construction,
 * the drain pause/resume, and how each broker detects a reconnect).
 */
export abstract class ConnectionDriverBase implements IIrisDriver {
  abstract readonly capabilities: IrisCapabilities;

  protected readonly logger: ILogger;
  protected readonly meta: IrisHookMeta | undefined;
  protected readonly encryption: MessageEncryptionContext | undefined;
  private readonly driverType: IrisDriverType;
  private readonly getSubscribers: () => Array<IMessageSubscriber>;

  private _connectionState: IrisConnectionState = "disconnected";
  private readonly _emitter = new EventEmitter();
  private _connecting: Promise<void> | null = null;
  protected _replyQueueActive: boolean = false;
  /**
   * Dedupes an in-flight reconnect re-register (M13b). Left `null` when no
   * reconnect replay is running. Read by tests via `(driver as any)._reconnecting`.
   */
  protected _reconnecting: Promise<void> | null = null;

  protected constructor(options: ConnectionDriverBaseOptions) {
    this.driverType = options.driverType;
    this.logger = options.logger.child([options.loggerLabel]);
    this.meta = options.meta;
    this.encryption = options.encryption;
    this.getSubscribers = options.getSubscribers;
  }

  // --- Connection lifecycle -------------------------------------------------

  async connect(): Promise<void> {
    // Dedupe concurrent connect() calls (M13a): a second caller awaits the
    // in-flight promise instead of opening a second client (which would leak).
    // Cleared on settle (success or failure) so a later connect can retry.
    if (this._connecting) return this._connecting;

    this._connecting = this.doConnect().finally(() => {
      this._connecting = null;
    });

    return this._connecting;
  }

  async drain(timeout?: number): Promise<void> {
    this.setConnectionState("draining");

    await this.beforeDrain();

    // Poll the driver's in-flight count until it reaches 0 (or the timeout).
    const timeoutMs = timeout ?? 5000;
    const pollInterval = 10;
    const deadline = Date.now() + timeoutMs;

    while (this.getInFlightCount() > 0 && Date.now() < deadline) {
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, pollInterval);
        t.unref();
      });
    }

    if (this.getInFlightCount() > 0) {
      this.logger.warn("Drain timeout reached with in-flight consumers remaining", {
        inFlightCount: this.getInFlightCount(),
        timeoutMs,
      });
    }

    await this.afterDrain();

    this.setConnectionState("connected");
    this.logger.debug("Drained");
  }

  getConnectionState(): IrisConnectionState {
    return this._connectionState;
  }

  get connected(): boolean {
    return this._connectionState === "connected" || this._connectionState === "draining";
  }

  // --- Events ---------------------------------------------------------------

  on<K extends keyof IrisEvents>(
    event: K,
    listener: (...args: IrisEvents[K]) => void,
  ): void {
    this._emitter.on(event, listener);
  }

  off<K extends keyof IrisEvents>(
    event: K,
    listener: (...args: IrisEvents[K]) => void,
  ): void {
    this._emitter.off(event, listener);
  }

  once<K extends keyof IrisEvents>(
    event: K,
    listener: (...args: IrisEvents[K]) => void,
  ): void {
    this._emitter.once(event, listener);
  }

  // --- Reply queue ----------------------------------------------------------

  get replyQueueActive(): boolean {
    return this._replyQueueActive;
  }

  async setupReplyQueue(): Promise<void> {
    this._replyQueueActive = true;
    this.logger.debug("Reply queue active");
  }

  async teardownReplyQueue(): Promise<void> {
    this._replyQueueActive = false;
    this.logger.debug("Reply queue inactive");
  }

  // --- Pattern factories ----------------------------------------------------

  createPublisher<M extends IMessage>(target: Constructor<M>): IIrisPublisher<M> {
    return this.buildPublisher(target);
  }

  createMessageBus<M extends IMessage>(target: Constructor<M>): IIrisMessageBus<M> {
    return this.buildMessageBus(target);
  }

  createWorkerQueue<M extends IMessage>(target: Constructor<M>): IIrisWorkerQueue<M> {
    return this.buildWorkerQueue(target);
  }

  createStreamProcessor(): IIrisStreamProcessor {
    return this.buildStreamProcessor();
  }

  createRpcClient<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): IIrisRpcClient<Req, Res> {
    return this.buildRpcClient(requestTarget, responseTarget);
  }

  createRpcServer<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): IIrisRpcServer<Req, Res> {
    return this.buildRpcServer(requestTarget, responseTarget);
  }

  // --- Shared helpers for subclasses ----------------------------------------

  /** Emit a state-change event on every transition (unchanged behaviour). */
  protected setConnectionState(state: IrisConnectionState): void {
    this._connectionState = state;
    this._emitter.emit("connection:state", state);
  }

  /**
   * The option prefix every publish-capable pattern instance (publisher /
   * message-bus / worker-queue) needs. The driver's `buildX` hook spreads this
   * and appends its broker-specific state + managers.
   */
  protected sharedPatternOptions<M extends IMessage>(
    target: Constructor<M>,
  ): DriverBaseOptions<M> & { driverType: IrisDriverType } {
    return {
      target,
      driverType: this.driverType,
      logger: this.logger,
      meta: this.meta,
      encryption: this.encryption,
      getSubscribers: this.getSubscribers,
    };
  }

  /**
   * Run a reconnect re-register exactly once at a time (M13b). Preserves the
   * H6 re-register on reconnect for the brokers that drive their reconnect
   * through the `_reconnecting` promise (kafka / redis / nats). The broker
   * decides WHAT to replay (the `reRegister` closure); the base owns the
   * guard, error logging, and clearing on settle.
   */
  protected triggerReRegister(reRegister: () => Promise<void>): void {
    if (this._reconnecting) return;

    this._reconnecting = reRegister()
      .catch((error) => {
        this.logger.error("Failed to re-register consumers after reconnect", {
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        this._reconnecting = null;
      });
  }

  // --- Broker-specific hooks ------------------------------------------------

  /** Establish the broker connection. Wrapped by the `connect()` guard. */
  protected abstract doConnect(): Promise<void>;

  /** Current in-flight consumer count — the source polled by `drain()`. */
  protected abstract getInFlightCount(): number;

  /** Pause/stop consumers before the drain poll-loop. */
  protected abstract beforeDrain(): Promise<void>;

  /** Resume/re-register consumers after the drain poll-loop. */
  protected abstract afterDrain(): Promise<void>;

  protected abstract buildPublisher<M extends IMessage>(
    target: Constructor<M>,
  ): IIrisPublisher<M>;

  protected abstract buildMessageBus<M extends IMessage>(
    target: Constructor<M>,
  ): IIrisMessageBus<M>;

  protected abstract buildWorkerQueue<M extends IMessage>(
    target: Constructor<M>,
  ): IIrisWorkerQueue<M>;

  protected abstract buildStreamProcessor(): IIrisStreamProcessor;

  protected abstract buildRpcClient<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): IIrisRpcClient<Req, Res>;

  protected abstract buildRpcServer<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): IIrisRpcServer<Req, Res>;

  // --- Remaining interface surface (broker-specific) ------------------------

  abstract disconnect(): Promise<void>;
  abstract ping(): Promise<boolean>;
  abstract setup(messages: Array<Constructor<IMessage>>): Promise<void>;
  abstract reset(): Promise<void>;
  abstract getDeadLetters(
    options?: DeadLetterListOptions,
  ): Promise<Array<DeadLetterEntry>>;
  abstract purgeDeadLetters(options?: DeadLetterFilterOptions): Promise<number>;
  abstract cloneWithGetters(getSubscribers: () => Array<IMessageSubscriber>): IIrisDriver;
}
