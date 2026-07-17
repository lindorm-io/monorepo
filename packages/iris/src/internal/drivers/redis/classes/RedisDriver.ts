import { EventEmitter } from "node:events";
import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import { randomBytes } from "crypto";
import { hostname } from "os";
import type { IIrisDriver } from "../../../../interfaces/IrisDriver.js";
import type {
  IIrisMessageBus,
  IIrisPublisher,
  IIrisStreamProcessor,
  IIrisWorkerQueue,
  IMessage,
  IMessageSubscriber,
} from "../../../../interfaces/index.js";
import type {
  IrisConnectionState,
  IrisEvents,
  IrisHookMeta,
  RedisConnectionOptions,
} from "../../../../types/index.js";
import { IrisPublishError } from "../../../../errors/IrisPublishError.js";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager.js";
import type {
  DeadLetterEntry,
  DeadLetterFilterOptions,
  DeadLetterListOptions,
} from "../../../../types/dead-letter.js";
import type { DelayManager } from "../../../delay/DelayManager.js";
import type { MessageEncryptionContext } from "../../../message/types/encryption-context.js";
import type { RedisSharedState } from "../types/redis-types.js";
import { resolveBroadcastDestination } from "../../../utils/resolve-broadcast-destination.js";
import { createConsumerLoop } from "../utils/create-consumer-loop.js";
import { resolveStreamKey } from "../utils/resolve-stream-key.js";
import { serializeStreamFields } from "../utils/serialize-stream-fields.js";
import { stopAllConsumerLoops } from "../utils/stop-consumer-loop.js";
import { xaddToStream } from "../utils/xadd-to-stream.js";
import { RedisMessageBus } from "./RedisMessageBus.js";
import { RedisPublisher } from "./RedisPublisher.js";
import { RedisRpcClient } from "./RedisRpcClient.js";
import { RedisRpcServer } from "./RedisRpcServer.js";
import { RedisStreamProcessor } from "./RedisStreamProcessor.js";
import { RedisWorkerQueue } from "./RedisWorkerQueue.js";

const DEFAULT_PREFETCH = 10;
const DEFAULT_BLOCK_MS = 5000;
const DEFAULT_PREFIX = "iris";

export type RedisDriverOptions = {
  logger: ILogger;
  meta?: IrisHookMeta;
  encryption?: MessageEncryptionContext;
  getSubscribers: () => Array<IMessageSubscriber>;
  url?: string;
  connection?: RedisConnectionOptions;
  prefix?: string;
  prefetch?: number;
  blockMs?: number;
  maxStreamLength?: number | null;
  delayManager?: DelayManager;
  deadLetterManager?: DeadLetterManager;
};

export class RedisDriver implements IIrisDriver {
  private readonly logger: ILogger;
  private readonly meta: IrisHookMeta | undefined;
  private readonly encryption: MessageEncryptionContext | undefined;
  private readonly getSubscribers: () => Array<IMessageSubscriber>;
  private readonly state: RedisSharedState;
  private readonly delayManager: DelayManager | undefined;
  private readonly deadLetterManager: DeadLetterManager | undefined;
  private _connectionState: IrisConnectionState = "disconnected";
  private readonly _emitter = new EventEmitter();
  private _replyQueueActive: boolean = false;
  private _deliberateDisconnect: boolean = false;
  private _reconnecting: Promise<void> | null = null;
  private _connecting: Promise<void> | null = null;

  constructor(options: RedisDriverOptions, state?: RedisSharedState) {
    this.logger = options.logger.child(["RedisDriver"]);
    this.meta = options.meta;
    this.encryption = options.encryption;
    this.getSubscribers = options.getSubscribers;
    this.delayManager = options.delayManager;
    this.deadLetterManager = options.deadLetterManager;

    this.state = state ?? {
      publishConnection: null,
      connectionConfig: { url: options.url, ...options.connection },
      prefix: options.prefix ?? DEFAULT_PREFIX,
      consumerName: `iris:${hostname()}:${process.pid}:${randomBytes(4).toString("hex")}`,
      consumerLoops: [],
      consumerRegistrations: [],
      createdGroups: new Set(),
      publishedStreams: new Set(),
      inFlightCount: 0,
      prefetch: options.prefetch ?? DEFAULT_PREFETCH,
      blockMs: options.blockMs ?? DEFAULT_BLOCK_MS,
      maxStreamLength: options.maxStreamLength ?? null,
    };
  }

  async connect(): Promise<void> {
    // Dedupe concurrent connect() calls: a second caller awaits the in-flight
    // promise instead of opening a second client (which would leak). Cleared on
    // settle (success or failure) so a later connect can retry.
    if (this._connecting) return this._connecting;

    this._connecting = this.doConnect().finally(() => {
      this._connecting = null;
    });

    return this._connecting;
  }

  private async doConnect(): Promise<void> {
    this._deliberateDisconnect = false;
    this.setConnectionState("connecting");

    try {
      const ioredis = await import("ioredis");
      const Redis = ioredis.Redis;

      const {
        url,
        host,
        port,
        password,
        db,
        tls,
        connectTimeout,
        commandTimeout,
        keepAlive,
        connectionName,
        enableReadyCheck,
        maxRetriesPerRequest,
        retryStrategy,
      } = this.state.connectionConfig;

      const redisOptions: Record<string, unknown> = {};
      if (password !== undefined) redisOptions.password = password;
      if (db !== undefined) redisOptions.db = db;
      if (tls !== undefined) redisOptions.tls = tls;
      if (connectTimeout !== undefined) redisOptions.connectTimeout = connectTimeout;
      if (commandTimeout !== undefined) redisOptions.commandTimeout = commandTimeout;
      if (keepAlive !== undefined) redisOptions.keepAlive = keepAlive;
      if (connectionName !== undefined) redisOptions.connectionName = connectionName;
      if (enableReadyCheck !== undefined)
        redisOptions.enableReadyCheck = enableReadyCheck;
      if (maxRetriesPerRequest !== undefined)
        redisOptions.maxRetriesPerRequest = maxRetriesPerRequest;
      if (retryStrategy !== undefined) redisOptions.retryStrategy = retryStrategy;

      const hasOptions = Object.keys(redisOptions).length > 0;

      const redis = url
        ? hasOptions
          ? new Redis(url, redisOptions)
          : new Redis(url)
        : hasOptions
          ? new Redis({ host, port, ...redisOptions } as any)
          : new Redis(port ?? 6379, host ?? "localhost");

      // Wait for connection — check status first in case ioredis
      // already connected before listener is attached
      if ((redis as any).status !== "ready") {
        await new Promise<void>((resolve, reject) => {
          redis.once("ready", () => resolve());
          redis.once("error", (err) => reject(err));
        });
      }

      this.state.publishConnection = redis as any;

      redis.on("error", (err) => {
        this.logger.error("Redis connection error", { error: err.message });
      });

      redis.on("close", () => {
        this.logger.warn("Redis connection closed");
        if (!this._deliberateDisconnect && this._connectionState !== "reconnecting") {
          this.setConnectionState("reconnecting");
        }
      });

      redis.on("reconnecting", () => {
        if (!this._deliberateDisconnect) {
          this.logger.debug("Redis reconnecting");
          this.setConnectionState("reconnecting");
        }
      });

      redis.on("ready", () => {
        if (this._deliberateDisconnect) return;

        // Only handle re-ready (reconnection). Initial ready is handled below.
        if (this._connectionState === "reconnecting") {
          this.logger.info("Redis reconnected");
          this.setConnectionState("connected");

          // Consumer loops use dedicated connections with retryStrategy: null,
          // so they die when the publish connection drops. Stop stale loops
          // before re-registering to avoid duplicate consumer loops.
          if (!this._reconnecting) {
            this._reconnecting = stopAllConsumerLoops(this.state)
              .then(() => this.reRegisterConsumers())
              .catch((error) => {
                this.logger.error("Failed to re-register consumers after reconnect", {
                  error: error instanceof Error ? error.message : String(error),
                });
              })
              .finally(() => {
                this._reconnecting = null;
              });
          }
        }
      });

      if (this.delayManager) {
        this.delayManager.start(async (entry) => {
          // Throw (do NOT silently no-op) when the connection is unavailable at
          // fire time, so the DelayManager keeps the entry and retries it on the
          // next poll instead of dropping the delayed/retry message.
          const conn = this.state.publishConnection;
          if (!conn) {
            throw new IrisPublishError("Redis connection not available", {
              code: "publish_connection_unavailable",
              title: "Publish Connection Unavailable",
              details:
                "The Redis publish connection is not established, so the delayed message cannot be delivered.",
              data: { driver: "redis" },
            });
          }

          // Route a delayed broadcast to the broadcast stream, exactly as the
          // non-delayed publish path does — otherwise a delayed @Broadcast lands
          // on the shared stream and only one consumer receives it.
          const streamKey = resolveBroadcastDestination(
            resolveStreamKey(this.state.prefix, entry.topic),
            entry.envelope.broadcast,
            ":",
          );
          const fields = serializeStreamFields(entry.envelope);

          await xaddToStream(conn, streamKey, fields, this.state.maxStreamLength);
          this.state.publishedStreams.add(streamKey);
        });
      }

      this.setConnectionState("connected");
      this.logger.info("Connected");
    } catch (error) {
      this.setConnectionState("disconnected");
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this._deliberateDisconnect = true;

    if (this.delayManager) {
      this.delayManager.stop();
    }

    await stopAllConsumerLoops(this.state);

    if (this.state.publishConnection) {
      try {
        await this.state.publishConnection.disconnect();
      } catch {
        // Connection may already be closed
      }
      this.state.publishConnection = null;
    }

    this._replyQueueActive = false;
    this.setConnectionState("disconnected");
    this.logger.info("Disconnected");
  }

  async drain(_timeout?: number): Promise<void> {
    this.setConnectionState("draining");

    await stopAllConsumerLoops(this.state);

    // Poll inFlightCount until 0
    const timeout = _timeout ?? 5000;
    const pollInterval = 10;
    const deadline = Date.now() + timeout;

    while (this.state.inFlightCount > 0 && Date.now() < deadline) {
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, pollInterval);
        t.unref();
      });
    }

    if (this.state.inFlightCount > 0) {
      this.logger.warn("Drain timeout reached with in-flight consumers remaining", {
        inFlightCount: this.state.inFlightCount,
        timeoutMs: timeout,
      });
    }

    await this.reRegisterConsumers();

    this.setConnectionState("connected");
    this.logger.debug("Drained");
  }

  async ping(): Promise<boolean> {
    if (!this.state.publishConnection) return false;

    try {
      const result = await this.state.publishConnection.ping();
      return result === "PONG";
    } catch {
      return false;
    }
  }

  async setup(_messages: Array<Constructor<IMessage>>): Promise<void> {
    this.logger.debug("Setup complete (Redis streams auto-create on write)");
  }

  async reset(): Promise<void> {
    await stopAllConsumerLoops(this.state);

    // Delete all known streams from Redis to prevent stale messages
    // from leaking into subsequent consumer groups after reset.
    if (this.state.publishConnection) {
      const streamKeys = new Set<string>();

      // Collect stream keys from consumer groups
      for (const groupKey of this.state.createdGroups) {
        const lastColon = groupKey.lastIndexOf(":");
        if (lastColon > 0) {
          streamKeys.add(groupKey.slice(0, lastColon));
        }
      }

      // Collect stream keys from published streams
      for (const key of this.state.publishedStreams) {
        streamKeys.add(key);
      }

      if (streamKeys.size > 0) {
        try {
          await this.state.publishConnection.del(...streamKeys);
        } catch {
          // Best-effort cleanup
        }
      }
    }

    this.state.consumerRegistrations.length = 0;
    this.state.createdGroups.clear();
    this.state.publishedStreams.clear();
    this._replyQueueActive = false;

    this.logger.debug("Reset");
  }

  async getDeadLetters(options?: DeadLetterListOptions): Promise<Array<DeadLetterEntry>> {
    if (!this.deadLetterManager) return [];
    return this.deadLetterManager.list(options);
  }

  async purgeDeadLetters(options?: DeadLetterFilterOptions): Promise<number> {
    if (!this.deadLetterManager) return 0;
    return this.deadLetterManager.purge(options);
  }

  getConnectionState(): IrisConnectionState {
    return this._connectionState;
  }

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

  createPublisher<M extends IMessage>(target: Constructor<M>): IIrisPublisher<M> {
    return new RedisPublisher<M>({
      target,
      logger: this.logger,
      meta: this.meta,
      encryption: this.encryption,
      getSubscribers: this.getSubscribers,
      state: this.state,
      delayManager: this.delayManager,
    });
  }

  createMessageBus<M extends IMessage>(target: Constructor<M>): IIrisMessageBus<M> {
    return new RedisMessageBus<M>({
      target,
      logger: this.logger,
      meta: this.meta,
      encryption: this.encryption,
      getSubscribers: this.getSubscribers,
      state: this.state,
      delayManager: this.delayManager,
      deadLetterManager: this.deadLetterManager,
    });
  }

  createWorkerQueue<M extends IMessage>(target: Constructor<M>): IIrisWorkerQueue<M> {
    return new RedisWorkerQueue<M>({
      target,
      logger: this.logger,
      meta: this.meta,
      encryption: this.encryption,
      getSubscribers: this.getSubscribers,
      state: this.state,
      delayManager: this.delayManager,
      deadLetterManager: this.deadLetterManager,
    });
  }

  createStreamProcessor(): IIrisStreamProcessor {
    return new RedisStreamProcessor({
      state: this.state,
      logger: this.logger,
      meta: this.meta,
      encryption: this.encryption,
      deadLetterManager: this.deadLetterManager,
      delayManager: this.delayManager,
    });
  }

  createRpcClient<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): RedisRpcClient<Req, Res> {
    return new RedisRpcClient({
      state: this.state,
      logger: this.logger,
      requestTarget,
      responseTarget,
      meta: this.meta,
      encryption: this.encryption,
    });
  }

  createRpcServer<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): RedisRpcServer<Req, Res> {
    return new RedisRpcServer({
      state: this.state,
      logger: this.logger,
      requestTarget,
      responseTarget,
      meta: this.meta,
      encryption: this.encryption,
    });
  }

  async setupReplyQueue(): Promise<void> {
    this._replyQueueActive = true;
    this.logger.debug("Reply queue active");
  }

  async teardownReplyQueue(): Promise<void> {
    this._replyQueueActive = false;
    this.logger.debug("Reply queue inactive");
  }

  cloneWithGetters(getSubscribers: () => Array<IMessageSubscriber>): IIrisDriver {
    return new RedisDriver(
      {
        logger: this.logger,
        meta: this.meta,
        encryption: this.encryption,
        getSubscribers,
        url: this.state.connectionConfig.url,
        connection: this.state.connectionConfig,
        prefix: this.state.prefix,
        prefetch: this.state.prefetch,
        blockMs: this.state.blockMs,
        maxStreamLength: this.state.maxStreamLength,
        delayManager: this.delayManager,
        deadLetterManager: this.deadLetterManager,
      },
      this.state,
    );
  }

  get connected(): boolean {
    return this._connectionState === "connected" || this._connectionState === "draining";
  }

  get replyQueueActive(): boolean {
    return this._replyQueueActive;
  }

  private async reRegisterConsumers(): Promise<void> {
    if (!this.state.publishConnection) return;

    const registrations = [...this.state.consumerRegistrations];

    for (const reg of registrations) {
      try {
        const loop = await createConsumerLoop({
          publishConnection: this.state.publishConnection,
          streamKey: reg.streamKey,
          groupName: reg.groupName,
          consumerName: reg.consumerName,
          blockMs: this.state.blockMs,
          count: this.state.prefetch,
          onEntry: reg.callback,
          logger: this.logger,
          createdGroups: this.state.createdGroups,
          // Adopt the dead loop's identity so its pending (delivered-but-unACKed)
          // entries are reclaimed on the "0" read instead of being stranded in
          // the now-defunct consumer's PEL — otherwise a message in flight at the
          // moment the connection dropped is never redelivered (data loss).
          consumerTag: reg.consumerTag,
        });
        this.state.consumerLoops.push(loop);

        // consumerTag is preserved (reg.consumerTag === loop.consumerTag), but
        // reassign defensively in case the reuse path ever changes.
        reg.consumerTag = loop.consumerTag;
      } catch (error) {
        this.logger.error("Failed to re-register consumer", {
          streamKey: reg.streamKey,
          groupName: reg.groupName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private setConnectionState(state: IrisConnectionState): void {
    this._connectionState = state;
    this._emitter.emit("connection:state", state);
  }
}
