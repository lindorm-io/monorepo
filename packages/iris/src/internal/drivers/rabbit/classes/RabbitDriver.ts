import { EventEmitter } from "node:events";
import amqplib from "amqplib";
import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
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
  RabbitConnectionOptions,
} from "../../../../types/index.js";
import type { IAmphora } from "@lindorm/amphora";
import type { RabbitSharedState } from "../types/rabbit-types.js";
import { RabbitMessageBus } from "./RabbitMessageBus.js";
import { RabbitPublisher } from "./RabbitPublisher.js";
import { RabbitRpcClient } from "./RabbitRpcClient.js";
import { RabbitRpcServer } from "./RabbitRpcServer.js";
import { RabbitStreamProcessor } from "./RabbitStreamProcessor.js";
import { RabbitWorkerQueue } from "./RabbitWorkerQueue.js";

const DEFAULT_PREFETCH = 10;
const DEFAULT_EXCHANGE = "iris";

const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;

export type RabbitDriverOptions = {
  logger: ILogger;
  context?: unknown;
  amphora?: IAmphora;
  getSubscribers: () => Array<IMessageSubscriber>;
  url: string;
  connection?: RabbitConnectionOptions;
  exchange?: string;
  prefetch?: number;
};

export class RabbitDriver implements IIrisDriver {
  private readonly logger: ILogger;
  private readonly context: unknown;
  private readonly amphora: IAmphora | undefined;
  private readonly getSubscribers: () => Array<IMessageSubscriber>;
  private readonly connectionConfig: { url: string } & RabbitConnectionOptions;
  private readonly state: RabbitSharedState;
  private _connectionState: IrisConnectionState = "disconnected";
  private readonly _emitter = new EventEmitter();
  private _replyQueueActive: boolean = false;
  private _deliberateDisconnect: boolean = false;
  private _reconnectAttempt: number = 0;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _publishChannelOpen: boolean = false;
  private _consumeChannelOpen: boolean = false;

  public constructor(options: RabbitDriverOptions, state?: RabbitSharedState) {
    this.logger = options.logger.child(["RabbitDriver"]);
    this.context = options.context;
    this.amphora = options.amphora;
    this.getSubscribers = options.getSubscribers;
    this.connectionConfig = { url: options.url, ...options.connection };

    const exchange = options.exchange ?? DEFAULT_EXCHANGE;

    this.state = state ?? {
      connection: null,
      publishChannel: null,
      consumeChannel: null,
      exchange,
      dlxExchange: `${exchange}.dlx`,
      dlqQueue: `${exchange}.dlq`,
      consumerRegistrations: [],
      assertedQueues: new Set(),
      assertedDelayQueues: new Set(),
      replyConsumerTags: [],
      reconnecting: false,
      prefetch: options.prefetch ?? DEFAULT_PREFETCH,
      inFlightCount: 0,
    };
  }

  public async connect(): Promise<void> {
    this._deliberateDisconnect = false;
    this.setConnectionState("connecting");

    try {
      const { url, socketOptions, heartbeat } = this.connectionConfig;
      const connection = await amqplib.connect(url, {
        ...socketOptions,
        heartbeat,
      } as any);

      this.state.connection = connection;

      const publishChannel = await connection.createConfirmChannel();
      this.state.publishChannel = publishChannel;
      this._publishChannelOpen = true;

      const consumeChannel = await connection.createChannel();
      await consumeChannel.prefetch(this.state.prefetch);
      this.state.consumeChannel = consumeChannel;
      this._consumeChannelOpen = true;

      this.registerConnectionHandlers(connection);
      this.registerChannelHandlers(publishChannel, "publish");
      this.registerChannelHandlers(consumeChannel, "consume");
      this.registerReturnHandler(publishChannel);

      this._reconnectAttempt = 0;
      this.state.reconnecting = false;
      this.setConnectionState("connected");
      this.logger.debug("Connected");
    } catch (error) {
      this.setConnectionState("disconnected");
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    this._deliberateDisconnect = true;

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this.state.reconnecting = false;

    await this.cancelAllConsumers();

    if (this.state.publishChannel) {
      try {
        await this.state.publishChannel.close();
      } catch {
        // Channel may already be closed
      }
      this.state.publishChannel = null;
    }

    if (this.state.consumeChannel) {
      try {
        await this.state.consumeChannel.close();
      } catch {
        // Channel may already be closed
      }
      this.state.consumeChannel = null;
    }

    if (this.state.connection) {
      try {
        await this.state.connection.close();
      } catch {
        // Connection may already be closed
      }
      this.state.connection = null;
    }

    this._replyQueueActive = false;
    this._publishChannelOpen = false;
    this._consumeChannelOpen = false;
    this.setConnectionState("disconnected");
    this.logger.debug("Disconnected");
  }

  public async drain(_timeout?: number): Promise<void> {
    this.setConnectionState("draining");

    await this.cancelAllConsumers();

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

  public async ping(): Promise<boolean> {
    return this.state.connection !== null && this.connected;
  }

  public async reset(): Promise<void> {
    await this.cancelAllConsumers();
    await this.cancelReplyConsumers();

    // Purge durable queues so messages don't leak between callers.
    // Unlike deleteQueue, purgeQueue doesn't cause a channel error if
    // the queue exists — and we only purge queues we've asserted.
    const channel = this.state.consumeChannel;
    if (channel && this._consumeChannelOpen) {
      for (const queue of this.state.assertedQueues) {
        try {
          await channel.purgeQueue(queue);
        } catch {
          // Queue may have been auto-deleted
        }
      }
      for (const queue of this.state.assertedDelayQueues) {
        try {
          await channel.purgeQueue(queue);
        } catch {
          // Queue may have been auto-deleted
        }
      }
    }

    this.state.consumerRegistrations.length = 0;
    this.state.assertedQueues.clear();
    this.state.assertedDelayQueues.clear();
    this._replyQueueActive = false;

    await this.ensureChannels();

    this.logger.debug("Reset");
  }

  public async setup(_messages: Array<Constructor<IMessage>>): Promise<void> {
    const channel = this.state.publishChannel;
    if (!channel) {
      throw new Error("Cannot setup: publish channel is not available");
    }

    await channel.assertExchange(this.state.exchange, "topic", { durable: true });
    await channel.assertExchange(this.state.dlxExchange, "topic", { durable: true });
    await channel.assertQueue(this.state.dlqQueue, { durable: true });
    await channel.bindQueue(this.state.dlqQueue, this.state.dlxExchange, "#");

    this.logger.debug("Setup complete", {
      exchange: this.state.exchange,
      dlxExchange: this.state.dlxExchange,
      dlqQueue: this.state.dlqQueue,
    });
  }

  public getConnectionState(): IrisConnectionState {
    return this._connectionState;
  }

  public on<K extends keyof IrisEvents>(
    event: K,
    listener: (...args: IrisEvents[K]) => void,
  ): void {
    this._emitter.on(event, listener);
  }

  public off<K extends keyof IrisEvents>(
    event: K,
    listener: (...args: IrisEvents[K]) => void,
  ): void {
    this._emitter.off(event, listener);
  }

  public once<K extends keyof IrisEvents>(
    event: K,
    listener: (...args: IrisEvents[K]) => void,
  ): void {
    this._emitter.once(event, listener);
  }

  public createPublisher<M extends IMessage>(target: Constructor<M>): IIrisPublisher<M> {
    return new RabbitPublisher<M>({
      target,
      logger: this.logger,
      context: this.context,
      amphora: this.amphora,
      getSubscribers: this.getSubscribers,
      state: this.state,
    });
  }

  public createMessageBus<M extends IMessage>(
    target: Constructor<M>,
  ): IIrisMessageBus<M> {
    return new RabbitMessageBus<M>({
      target,
      logger: this.logger,
      context: this.context,
      amphora: this.amphora,
      getSubscribers: this.getSubscribers,
      state: this.state,
    });
  }

  public createWorkerQueue<M extends IMessage>(
    target: Constructor<M>,
  ): IIrisWorkerQueue<M> {
    return new RabbitWorkerQueue<M>({
      target,
      logger: this.logger,
      context: this.context,
      amphora: this.amphora,
      getSubscribers: this.getSubscribers,
      state: this.state,
    });
  }

  public createStreamProcessor(): IIrisStreamProcessor {
    return new RabbitStreamProcessor({
      state: this.state,
      logger: this.logger,
      context: this.context,
      amphora: this.amphora,
    });
  }

  public createRpcClient<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): RabbitRpcClient<Req, Res> {
    return new RabbitRpcClient({
      state: this.state,
      logger: this.logger,
      requestTarget,
      responseTarget,
      context: this.context,
      amphora: this.amphora,
    });
  }

  public createRpcServer<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): RabbitRpcServer<Req, Res> {
    return new RabbitRpcServer({
      state: this.state,
      logger: this.logger,
      requestTarget,
      responseTarget,
      context: this.context,
      amphora: this.amphora,
    });
  }

  public async setupReplyQueue(): Promise<void> {
    this._replyQueueActive = true;
    this.logger.debug("Reply queue active");
  }

  public async teardownReplyQueue(): Promise<void> {
    this._replyQueueActive = false;
    this.logger.debug("Reply queue inactive");
  }

  public cloneWithGetters(getSubscribers: () => Array<IMessageSubscriber>): IIrisDriver {
    return new RabbitDriver(
      {
        logger: this.logger,
        context: this.context,
        amphora: this.amphora,
        getSubscribers,
        url: this.connectionConfig.url,
        connection: this.connectionConfig,
        exchange: this.state.exchange,
        prefetch: this.state.prefetch,
      },
      this.state,
    );
  }

  public get connected(): boolean {
    return this._connectionState === "connected" || this._connectionState === "draining";
  }

  public get replyQueueActive(): boolean {
    return this._replyQueueActive;
  }

  private setConnectionState(state: IrisConnectionState): void {
    this._connectionState = state;
    this._emitter.emit("connection:state", state);
  }

  private registerConnectionHandlers(connection: amqplib.ChannelModel): void {
    connection.on("error", (err) => {
      this.logger.error("Connection error", { error: err.message });
    });

    connection.on("close", () => {
      this.logger.warn("Connection closed");
      this.state.connection = null;
      this.state.publishChannel = null;
      this.state.consumeChannel = null;

      if (!this._deliberateDisconnect) {
        this.attemptReconnect();
      }
    });
  }

  private registerChannelHandlers(channel: amqplib.Channel, label: string): void {
    channel.on("error", (err) => {
      this.logger.error(`${label} channel error`, { error: err.message });
    });

    channel.on("close", () => {
      this.logger.warn(`${label} channel closed`);
      if (label === "publish") {
        this._publishChannelOpen = false;
      } else if (label === "consume") {
        this._consumeChannelOpen = false;
      }
    });
  }

  private registerReturnHandler(channel: amqplib.ConfirmChannel): void {
    channel.on("return", (msg) => {
      this.logger.warn("Message returned (unroutable)", {
        topic: msg.fields.routingKey,
        exchange: msg.fields.exchange,
        replyText: msg.fields.replyText,
      });

      try {
        const headers = {
          ...(msg.properties.headers ?? {}),
          "x-iris-return-reason": msg.fields.replyText ?? "unroutable",
        };

        channel.publish(this.state.dlxExchange, msg.fields.routingKey, msg.content, {
          ...msg.properties,
          headers,
          mandatory: false,
        });

        this.logger.debug("Returned message forwarded to DLX", {
          dlxExchange: this.state.dlxExchange,
          routingKey: msg.fields.routingKey,
        });
      } catch (error) {
        this.logger.error("Failed to forward returned message to DLX", {
          error: error instanceof Error ? error.message : String(error),
          routingKey: msg.fields.routingKey,
        });
      }
    });
  }

  private attemptReconnect(): void {
    if (this._deliberateDisconnect) return;
    if (this.state.reconnecting) return;
    this.state.reconnecting = true;
    this.setConnectionState("reconnecting");

    this._reconnectAttempt++;

    const baseDelay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, this._reconnectAttempt - 1),
      RECONNECT_MAX_DELAY,
    );
    const jitter = Math.random() * baseDelay * 0.3;
    const delay = baseDelay + jitter;

    this.logger.debug("Scheduling reconnect", {
      attempt: this._reconnectAttempt,
      delayMs: Math.round(delay),
    });

    this._reconnectTimer = setTimeout(async () => {
      this._reconnectTimer = null;

      try {
        await this.connect();

        if (!this.state.publishChannel) {
          this.logger.warn("Publish channel unavailable after reconnect, will retry");
          this.state.reconnecting = false;
          if (!this._deliberateDisconnect) {
            this.attemptReconnect();
          }
          return;
        }

        await this.state.publishChannel.assertExchange(this.state.exchange, "topic", {
          durable: true,
        });
        await this.state.publishChannel.assertExchange(this.state.dlxExchange, "topic", {
          durable: true,
        });

        await this.reRegisterConsumers();
        this.state.reconnecting = false;

        // Guard against a close event that fired while we were reconnecting.
        // The close handler no-ops when reconnecting===true, so if the
        // connection dropped between connect() and here, no reconnect was
        // scheduled. Re-trigger it now.
        if (!this.state.connection || !this.state.publishChannel) {
          if (!this._deliberateDisconnect) {
            this.attemptReconnect();
            return;
          }
        }

        this.logger.debug("Reconnected and consumers re-registered");
      } catch (error) {
        this.logger.error("Reconnect failed", {
          error: error instanceof Error ? error.message : String(error),
          attempt: this._reconnectAttempt,
        });

        this.state.reconnecting = false;

        if (!this._deliberateDisconnect) {
          this.attemptReconnect();
        }
      }
    }, delay);
    this._reconnectTimer.unref();
  }

  private async ensureChannels(): Promise<void> {
    const connection = this.state.connection;
    if (!connection) return;

    if (!this.state.publishChannel || !this._publishChannelOpen) {
      try {
        const publishChannel = await connection.createConfirmChannel();
        this.state.publishChannel = publishChannel;
        this._publishChannelOpen = true;
        this.registerChannelHandlers(publishChannel, "publish");
        this.registerReturnHandler(publishChannel);

        // Re-assert exchanges on the new channel
        await publishChannel.assertExchange(this.state.exchange, "topic", {
          durable: true,
        });
        await publishChannel.assertExchange(this.state.dlxExchange, "topic", {
          durable: true,
        });

        this.logger.debug("Recreated publish channel");
      } catch (error) {
        this.logger.error("Failed to recreate publish channel", {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    if (!this.state.consumeChannel || !this._consumeChannelOpen) {
      try {
        const consumeChannel = await connection.createChannel();
        await consumeChannel.prefetch(this.state.prefetch);
        this.state.consumeChannel = consumeChannel;
        this._consumeChannelOpen = true;
        this.registerChannelHandlers(consumeChannel, "consume");

        this.logger.debug("Recreated consume channel");
      } catch (error) {
        this.logger.error("Failed to recreate consume channel", {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }
  }

  private async cancelAllConsumers(): Promise<void> {
    const channel = this.state.consumeChannel;
    if (!channel || !this._consumeChannelOpen) return;

    for (const reg of this.state.consumerRegistrations) {
      try {
        // Unbind first so the exchange stops routing to this queue
        if (reg.routingKey && reg.exchange) {
          await channel.unbindQueue(reg.queue, reg.exchange, reg.routingKey);
        }
      } catch {
        // Queue or binding may already be gone
      }

      try {
        await channel.cancel(reg.consumerTag);
      } catch {
        // Consumer may already be cancelled or channel may have closed
      }
    }
  }

  private async cancelReplyConsumers(): Promise<void> {
    const channel = this.state.publishChannel;
    if (!channel || !this._publishChannelOpen) return;

    for (const tag of this.state.replyConsumerTags) {
      try {
        await channel.cancel(tag);
      } catch {
        // Consumer may already be cancelled
      }
    }
    this.state.replyConsumerTags = [];
  }

  private async reRegisterConsumers(): Promise<void> {
    const channel = this.state.consumeChannel;
    if (!channel) return;

    // Clear stale assertions — queues (especially exclusive/autoDelete) may be
    // gone after reconnect and need to be re-asserted.
    this.state.assertedQueues.clear();
    this.state.assertedDelayQueues.clear();

    const registrations = [...this.state.consumerRegistrations];
    this.state.consumerRegistrations.length = 0;

    for (const reg of registrations) {
      try {
        // Re-assert queue and re-bind if this registration was bound to an exchange
        if (reg.routingKey && reg.exchange) {
          const queueOptions = reg.queueOptions ?? { durable: true };
          const assertResult = await channel.assertQueue(
            (queueOptions as any).exclusive ? "" : reg.queue,
            queueOptions,
          );
          const resolvedQueue = assertResult.queue;
          reg.queue = resolvedQueue;
          await channel.bindQueue(resolvedQueue, reg.exchange, reg.routingKey);
          this.state.assertedQueues.add(resolvedQueue);
        }

        const { consumerTag } = await channel.consume(reg.queue, reg.onMessage);
        this.state.consumerRegistrations.push({
          ...reg,
          consumerTag,
        });
      } catch (error) {
        this.logger.error("Failed to re-register consumer", {
          queue: reg.queue,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
