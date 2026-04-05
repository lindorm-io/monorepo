import { EventEmitter } from "node:events";
import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IIrisDriver } from "../../../../interfaces/IrisDriver";
import type {
  IIrisMessageBus,
  IIrisPublisher,
  IIrisStreamProcessor,
  IIrisWorkerQueue,
  IMessage,
  IMessageSubscriber,
} from "../../../../interfaces";
import type {
  IrisConnectionState,
  IrisEvents,
  KafkaConnectionOptions,
} from "../../../../types";
import type { IAmphora } from "@lindorm/amphora";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager";
import type { DelayManager } from "../../../delay/DelayManager";
import type { KafkaSharedState } from "../types/kafka-types";
import { getMessageMetadata } from "../../../message/metadata/get-message-metadata";
import { resolveDefaultTopic } from "../../../message/utils/resolve-default-topic";
import { resolveTopicName } from "../utils/resolve-topic-name";
import { serializeKafkaMessage } from "../utils/serialize-kafka-message";
import { stopAllKafkaConsumers } from "../utils/stop-kafka-consumer";
import { KafkaMessageBus } from "./KafkaMessageBus";
import { KafkaPublisher } from "./KafkaPublisher";
import { KafkaRpcClient } from "./KafkaRpcClient";
import { KafkaRpcServer } from "./KafkaRpcServer";
import { KafkaStreamProcessor } from "./KafkaStreamProcessor";
import { KafkaWorkerQueue } from "./KafkaWorkerQueue";

const DEFAULT_PREFIX = "iris";
const DEFAULT_PREFETCH = 10;
const DEFAULT_SESSION_TIMEOUT_MS = 30_000;

export type KafkaDriverOptions = {
  logger: ILogger;
  context?: unknown;
  amphora?: IAmphora;
  getSubscribers: () => Array<IMessageSubscriber>;
  brokers: Array<string>;
  connection?: KafkaConnectionOptions;
  prefix?: string;
  prefetch?: number;
  sessionTimeoutMs?: number;
  acks?: -1 | 0 | 1;
  delayManager?: DelayManager;
  deadLetterManager?: DeadLetterManager;
};

export class KafkaDriver implements IIrisDriver {
  private readonly logger: ILogger;
  private readonly context: unknown;
  private readonly amphora: IAmphora | undefined;
  private readonly getSubscribers: () => Array<IMessageSubscriber>;
  private readonly state: KafkaSharedState;
  private readonly delayManager: DelayManager | undefined;
  private readonly deadLetterManager: DeadLetterManager | undefined;
  private _connectionState: IrisConnectionState = "disconnected";
  private readonly _emitter = new EventEmitter();
  private _replyQueueActive: boolean = false;
  private _deliberateDisconnect: boolean = false;
  private readonly _producerUnsubscribers: Array<() => void> = [];

  public constructor(options: KafkaDriverOptions, state?: KafkaSharedState) {
    this.logger = options.logger.child(["KafkaDriver"]);
    this.context = options.context;
    this.amphora = options.amphora;
    this.getSubscribers = options.getSubscribers;
    this.delayManager = options.delayManager;
    this.deadLetterManager = options.deadLetterManager;

    this.state = state ?? {
      kafka: null,
      producer: null,
      admin: null,
      connectionConfig: { brokers: options.brokers, ...options.connection },
      prefix: options.prefix ?? DEFAULT_PREFIX,
      consumers: [],
      consumerRegistrations: [],
      consumerPool: new Map(),
      inFlightCount: 0,
      prefetch: options.prefetch ?? DEFAULT_PREFETCH,
      sessionTimeoutMs: options.sessionTimeoutMs ?? DEFAULT_SESSION_TIMEOUT_MS,
      acks: options.acks ?? -1,
      createdTopics: new Set(),
      publishedTopics: new Set(),
      abortController: new AbortController(),
      resetGeneration: 0,
    };
  }

  public async connect(): Promise<void> {
    this._deliberateDisconnect = false;
    this.setConnectionState("connecting");

    try {
      const { Kafka, logLevel } = await import("kafkajs");

      const { brokers, clientId, ssl, sasl, connectionTimeout, requestTimeout, retry } =
        this.state.connectionConfig;
      const kafka = new Kafka({
        clientId: clientId ?? this.state.prefix,
        brokers,
        ssl,
        sasl: sasl as any,
        connectionTimeout,
        requestTimeout,
        retry,
        logLevel: logLevel.NOTHING,
      });

      const producer = kafka.producer();
      await producer.connect();

      const admin = kafka.admin();
      await admin.connect();

      this.state.kafka = kafka as any;
      this.state.producer = producer as any;
      this.state.admin = admin as any;

      this.registerProducerHandlers(producer as any);

      if (this.delayManager) {
        this.delayManager.start(async (entry) => {
          const kafkaTopic = resolveTopicName(this.state.prefix, entry.topic);
          const kafkaMessage = serializeKafkaMessage(entry.envelope);

          if (this.state.producer) {
            await this.state.producer.send({
              topic: kafkaTopic,
              messages: [kafkaMessage],
              acks: this.state.acks,
            });
            this.state.publishedTopics.add(kafkaTopic);
          }
        });
      }

      this.setConnectionState("connected");
      this.logger.debug("Connected");
    } catch (error) {
      this.setConnectionState("disconnected");
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    this._deliberateDisconnect = true;

    for (const unsub of this._producerUnsubscribers) {
      unsub();
    }
    this._producerUnsubscribers.length = 0;

    if (this.delayManager) {
      this.delayManager.stop();
    }

    this.state.abortController.abort();
    this.state.abortController = new AbortController();

    await stopAllKafkaConsumers(this.state);

    if (this.state.admin) {
      try {
        await this.state.admin.disconnect();
      } catch {
        // Admin may already be disconnected
      }
      this.state.admin = null;
    }

    if (this.state.producer) {
      try {
        await this.state.producer.disconnect();
      } catch {
        // Producer may already be disconnected
      }
      this.state.producer = null;
    }

    this.state.kafka = null;
    this._replyQueueActive = false;
    this.setConnectionState("disconnected");
    this.logger.debug("Disconnected");
  }

  public async drain(_timeout?: number): Promise<void> {
    this.setConnectionState("draining");

    // Pause all pooled consumers (all topics at once)
    for (const [, pooled] of this.state.consumerPool) {
      try {
        const topics = [...pooled.topics].map((t) => ({ topic: t }));
        pooled.consumer.pause(topics);
      } catch {
        // Consumer may already be paused
      }
    }

    // Pause all non-pooled consumers
    for (const handle of this.state.consumers) {
      const isPooled = [...this.state.consumerPool.values()].some(
        (p) => p.consumer === handle.consumer,
      );
      if (isPooled) continue;

      try {
        handle.consumer.pause([{ topic: handle.topic }]);
      } catch {
        // Consumer may already be paused
      }
    }

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

    // Resume all pooled consumers
    for (const [, pooled] of this.state.consumerPool) {
      try {
        const topics = [...pooled.topics].map((t) => ({ topic: t }));
        pooled.consumer.resume(topics);
      } catch {
        // Consumer may already be resumed
      }
    }

    // Resume all non-pooled consumers
    for (const handle of this.state.consumers) {
      const isPooled = [...this.state.consumerPool.values()].some(
        (p) => p.consumer === handle.consumer,
      );
      if (isPooled) continue;

      try {
        handle.consumer.resume([{ topic: handle.topic }]);
      } catch {
        // Consumer may already be resumed
      }
    }

    this.setConnectionState("connected");
    this.logger.debug("Drained");
  }

  public async ping(): Promise<boolean> {
    if (!this.state.admin) return false;

    try {
      // Calling connect() on an already-connected admin is a no-op in KafkaJS,
      // but will throw if the broker is unreachable — exactly what we want.
      await this.state.admin.connect();
      return true;
    } catch {
      return false;
    }
  }

  public async setup(messages: Array<Constructor<IMessage>>): Promise<void> {
    if (!this.state.kafka) {
      this.logger.warn("Cannot setup: Kafka client is not connected");
      return;
    }

    const admin = this.state.kafka.admin();

    try {
      await admin.connect();

      const existingTopics = await admin.listTopics();
      const topicsToCreate: Array<{ topic: string }> = [];

      for (const target of messages) {
        const metadata = getMessageMetadata(target);
        const topic = resolveDefaultTopic(metadata);
        const kafkaTopic = resolveTopicName(this.state.prefix, topic);
        const broadcastTopic = `${kafkaTopic}.broadcast`;
        const rpcTopic = resolveTopicName(this.state.prefix, `rpc.${topic}`);

        for (const t of [kafkaTopic, broadcastTopic, rpcTopic]) {
          if (!existingTopics.includes(t) && !this.state.createdTopics.has(t)) {
            topicsToCreate.push({ topic: t });
            this.state.createdTopics.add(t);
          }
        }
      }

      if (topicsToCreate.length > 0) {
        await admin.createTopics({
          topics: topicsToCreate,
          waitForLeaders: true,
        });

        this.logger.debug("Topics created", {
          count: topicsToCreate.length,
          topics: topicsToCreate.map((t) => t.topic),
        });
      }
    } finally {
      await admin.disconnect();
    }
  }

  public async reset(): Promise<void> {
    this.state.abortController.abort();
    this.state.abortController = new AbortController();

    await stopAllKafkaConsumers(this.state);

    // Don't delete Kafka topics — topic deletion is slow and causes
    // "topic-partition not hosted" errors on immediate re-subscribe.
    // Instead, rely on unique consumer group IDs per consumer instance
    // (each new consumer gets a fresh group that reads from latest).

    this.state.consumerRegistrations.length = 0;
    this.state.consumerPool.clear();
    // Keep createdTopics so setup() doesn't try to re-create existing topics
    this.state.publishedTopics.clear();
    this._replyQueueActive = false;

    // Increment generation so that resolveGroupId produces fresh group IDs.
    // This prevents new consumers from picking up uncommitted messages that
    // were published after the previous consumer stopped.
    this.state.resetGeneration++;

    this.logger.debug("Reset");
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
    return new KafkaPublisher<M>({
      target,
      logger: this.logger,
      context: this.context,
      amphora: this.amphora,
      getSubscribers: this.getSubscribers,
      state: this.state,
      delayManager: this.delayManager,
    });
  }

  public createMessageBus<M extends IMessage>(
    target: Constructor<M>,
  ): IIrisMessageBus<M> {
    return new KafkaMessageBus<M>({
      target,
      logger: this.logger,
      context: this.context,
      amphora: this.amphora,
      getSubscribers: this.getSubscribers,
      state: this.state,
      delayManager: this.delayManager,
      deadLetterManager: this.deadLetterManager,
    });
  }

  public createWorkerQueue<M extends IMessage>(
    target: Constructor<M>,
  ): IIrisWorkerQueue<M> {
    return new KafkaWorkerQueue<M>({
      target,
      logger: this.logger,
      context: this.context,
      amphora: this.amphora,
      getSubscribers: this.getSubscribers,
      state: this.state,
      delayManager: this.delayManager,
      deadLetterManager: this.deadLetterManager,
    });
  }

  public createStreamProcessor(): IIrisStreamProcessor {
    return new KafkaStreamProcessor({
      state: this.state,
      logger: this.logger,
      context: this.context,
      amphora: this.amphora,
    });
  }

  public createRpcClient<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): KafkaRpcClient<Req, Res> {
    return new KafkaRpcClient({
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
  ): KafkaRpcServer<Req, Res> {
    return new KafkaRpcServer({
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
    return new KafkaDriver(
      {
        logger: this.logger,
        context: this.context,
        amphora: this.amphora,
        getSubscribers,
        brokers: this.state.connectionConfig.brokers,
        connection: this.state.connectionConfig,
        prefix: this.state.prefix,
        prefetch: this.state.prefetch,
        sessionTimeoutMs: this.state.sessionTimeoutMs,
        acks: this.state.acks as -1 | 0 | 1,
        delayManager: this.delayManager,
        deadLetterManager: this.deadLetterManager,
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

  private registerProducerHandlers(
    producer: import("../types/kafka-types").KafkaProducer,
  ): void {
    const unsubDisconnect = producer.on(producer.events.DISCONNECT, () => {
      if (this._deliberateDisconnect) return;
      this.logger.warn("Kafka producer disconnected");
      this.setConnectionState("reconnecting");
    });

    const unsubConnect = producer.on(producer.events.CONNECT, () => {
      if (this._deliberateDisconnect) return;
      if (this._connectionState === "reconnecting") {
        this.logger.debug("Kafka producer reconnected");
        this.setConnectionState("connected");
      }
    });

    this._producerUnsubscribers.push(unsubDisconnect, unsubConnect);
  }

  private setConnectionState(state: IrisConnectionState): void {
    this._connectionState = state;
    this._emitter.emit("connection:state", state);
  }
}
