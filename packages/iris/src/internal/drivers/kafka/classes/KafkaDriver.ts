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
  IrisCapabilities,
  IrisHookMeta,
  KafkaConnectionSettings,
} from "../../../../types/index.js";
import { KAFKA_CAPABILITIES } from "../kafka-capabilities.js";
import { IrisPublishError } from "../../../../errors/IrisPublishError.js";
import type { MessageEncryptionContext } from "../../../message/types/encryption-context.js";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager.js";
import type {
  DeadLetterEntry,
  DeadLetterFilterOptions,
  DeadLetterListOptions,
} from "../../../../types/dead-letter.js";
import type { DelayManager } from "../../../delay/DelayManager.js";
import { ConnectionDriverBase } from "../../../classes/ConnectionDriverBase.js";
import type { KafkaSharedState } from "../types/kafka-types.js";
import { getMessageMetadata } from "../../../message/metadata/get-message-metadata.js";
import { resolveDefaultTopic } from "../../../message/utils/resolve-default-topic.js";
import { resolveBroadcastDestination } from "../../../utils/resolve-broadcast-destination.js";
import { resolveTopicName } from "../utils/resolve-topic-name.js";
import { serializeKafkaMessage } from "../utils/serialize-kafka-message.js";
import {
  detachAllKafkaConsumers,
  stopAllKafkaConsumers,
} from "../utils/stop-kafka-consumer.js";
import { reRegisterKafkaConsumers } from "../utils/re-register-kafka-consumers.js";
import { KafkaMessageBus } from "./KafkaMessageBus.js";
import { KafkaPublisher } from "./KafkaPublisher.js";
import { KafkaRpcClient } from "./KafkaRpcClient.js";
import { KafkaRpcServer } from "./KafkaRpcServer.js";
import { KafkaStreamProcessor } from "./KafkaStreamProcessor.js";
import { KafkaWorkerQueue } from "./KafkaWorkerQueue.js";

const DEFAULT_PREFIX = "iris";
const DEFAULT_PREFETCH = 10;
const DEFAULT_SESSION_TIMEOUT_MS = 30_000;

export type KafkaDriverSettings = {
  logger: ILogger;
  meta?: IrisHookMeta;
  encryption?: MessageEncryptionContext;
  getSubscribers: () => Array<IMessageSubscriber>;
  brokers: Array<string>;
  connection?: KafkaConnectionSettings;
  prefix?: string;
  prefetch?: number;
  sessionTimeoutMs?: number;
  acks?: -1 | 0 | 1;
  delayManager?: DelayManager;
  deadLetterManager?: DeadLetterManager;
};

export class KafkaDriver extends ConnectionDriverBase {
  readonly capabilities: IrisCapabilities = KAFKA_CAPABILITIES;
  private readonly state: KafkaSharedState;
  private readonly delayManager: DelayManager | undefined;
  private readonly deadLetterManager: DeadLetterManager | undefined;
  private _deliberateDisconnect: boolean = false;
  private readonly _producerUnsubscribers: Array<() => void> = [];

  constructor(options: KafkaDriverSettings, state?: KafkaSharedState) {
    super({
      driverType: "kafka",
      loggerLabel: "KafkaDriver",
      logger: options.logger,
      meta: options.meta,
      encryption: options.encryption,
      getSubscribers: options.getSubscribers,
    });
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
      retryConsumers: new Map(),
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

  protected async doConnect(): Promise<void> {
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
          // Throw (do NOT silently no-op) when the producer is unavailable at
          // fire time, so the DelayManager keeps the entry and retries it on the
          // next poll instead of dropping the delayed/retry message.
          const producer = this.state.producer;
          if (!producer) {
            throw new IrisPublishError("Kafka producer not available", {
              code: "publish_connection_unavailable",
              title: "Publish Connection Unavailable",
              details:
                "The Kafka producer is not connected, so the delayed message cannot be delivered.",
              data: { driver: "kafka" },
            });
          }

          // A targeted retry (M1) carries a fully-resolved destinationTopic —
          // the failing group's per-group retry topic — and must go there
          // verbatim, NOT be re-broadcast. For a normal delayed publish there is
          // no destinationTopic, so route a delayed broadcast to the broadcast
          // topic exactly as the non-delayed publish path does — otherwise a
          // delayed @Broadcast lands on the shared topic and only one consumer
          // receives it.
          const kafkaTopic =
            entry.destinationTopic ??
            resolveBroadcastDestination(
              resolveTopicName(this.state.prefix, entry.topic),
              entry.envelope.broadcast,
              ".",
            );
          const kafkaMessage = serializeKafkaMessage(entry.envelope);

          await producer.send({
            topic: kafkaTopic,
            messages: [kafkaMessage],
            acks: this.state.acks,
          });
          this.state.publishedTopics.add(kafkaTopic);
        });
      }

      this.setConnectionState("connected");
      this.logger.info("Connected");

      // Replay any consumers registered before a disconnect/connect cycle so a
      // reused driver resumes consuming. On a first connect the registry is
      // empty, so this is a no-op.
      if (this.state.consumerRegistrations.length > 0) {
        await reRegisterKafkaConsumers(this.state, this.logger);
      }
    } catch (error) {
      this.setConnectionState("disconnected");
      throw error;
    }
  }

  async disconnect(): Promise<void> {
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
    this.logger.info("Disconnected");
  }

  protected getInFlightCount(): number {
    return this.state.inFlightCount;
  }

  protected async beforeDrain(): Promise<void> {
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
  }

  protected async afterDrain(): Promise<void> {
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
  }

  async ping(): Promise<boolean> {
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

  async setup(messages: Array<Constructor<IMessage>>): Promise<void> {
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
        const rpcTopic = resolveTopicName(this.state.prefix, `rpc.${topic}`);

        // Only `@Broadcast` types ever publish to / consume from a `.broadcast`
        // topic (see KafkaWorkerQueue). Pre-creating one for a non-broadcast
        // type would leave a permanently-empty dead topic — and would defeat
        // the M14 gating that keeps non-broadcast types off `.broadcast`.
        const candidateTopics = metadata.broadcast
          ? [kafkaTopic, `${kafkaTopic}.broadcast`, rpcTopic]
          : [kafkaTopic, rpcTopic];

        for (const t of candidateTopics) {
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

        this.logger.info("Topics created", {
          count: topicsToCreate.length,
          topics: topicsToCreate.map((t) => t.topic),
        });
      }
    } finally {
      await admin.disconnect();
    }
  }

  async reset(): Promise<void> {
    this.state.abortController.abort();
    this.state.abortController = new AbortController();

    // Detach consumers without waiting for their stop/disconnect to complete.
    // stopConsumerWithTimeout() has a 2s-per-consumer cap; awaiting it in
    // beforeEach was the dominant cost of every kafka TCK test. Resources
    // are reclaimed in disconnect() during afterAll.
    detachAllKafkaConsumers(this.state);

    // Don't delete Kafka topics — topic deletion is slow and causes
    // "topic-partition not hosted" errors on immediate re-subscribe.
    // Instead, rely on unique consumer group IDs per consumer instance
    // (each new consumer gets a fresh group that reads from latest).

    this.state.consumerRegistrations.length = 0;
    // Drop any lazily-attached retry-topic memos (M1): their consumers were
    // detached above, so a stale entry would wrongly memoize an attach that no
    // longer exists. resetGeneration also renames future retry topics, so no
    // name collision either way.
    this.state.retryConsumers.clear();
    // Keep createdTopics so setup() doesn't try to re-create existing topics
    this.state.publishedTopics.clear();
    this._replyQueueActive = false;

    // Increment generation so that resolveGroupId produces fresh group IDs.
    // This prevents new consumers from picking up uncommitted messages that
    // were published after the previous consumer stopped.
    this.state.resetGeneration++;

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

  protected buildPublisher<M extends IMessage>(
    target: Constructor<M>,
  ): IIrisPublisher<M> {
    return new KafkaPublisher<M>({
      ...this.sharedPatternOptions(target),
      state: this.state,
      delayManager: this.delayManager,
    });
  }

  protected buildMessageBus<M extends IMessage>(
    target: Constructor<M>,
  ): IIrisMessageBus<M> {
    return new KafkaMessageBus<M>({
      ...this.sharedPatternOptions(target),
      state: this.state,
      delayManager: this.delayManager,
      deadLetterManager: this.deadLetterManager,
    });
  }

  protected buildWorkerQueue<M extends IMessage>(
    target: Constructor<M>,
  ): IIrisWorkerQueue<M> {
    return new KafkaWorkerQueue<M>({
      ...this.sharedPatternOptions(target),
      state: this.state,
      delayManager: this.delayManager,
      deadLetterManager: this.deadLetterManager,
    });
  }

  protected buildStreamProcessor(): IIrisStreamProcessor {
    return new KafkaStreamProcessor({
      state: this.state,
      logger: this.logger,
      meta: this.meta,
      encryption: this.encryption,
      deadLetterManager: this.deadLetterManager,
      delayManager: this.delayManager,
    });
  }

  protected buildRpcClient<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): KafkaRpcClient<Req, Res> {
    return new KafkaRpcClient({
      state: this.state,
      logger: this.logger,
      requestTarget,
      responseTarget,
      meta: this.meta,
      encryption: this.encryption,
    });
  }

  protected buildRpcServer<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): KafkaRpcServer<Req, Res> {
    return new KafkaRpcServer({
      state: this.state,
      logger: this.logger,
      requestTarget,
      responseTarget,
      meta: this.meta,
      encryption: this.encryption,
    });
  }

  cloneWithGetters(getSubscribers: () => Array<IMessageSubscriber>): IIrisDriver {
    return new KafkaDriver(
      {
        logger: this.logger,
        meta: this.meta,
        encryption: this.encryption,
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

  private registerProducerHandlers(
    producer: import("../types/kafka-types.js").KafkaProducer,
  ): void {
    const unsubDisconnect = producer.on(producer.events.DISCONNECT, () => {
      if (this._deliberateDisconnect) return;
      this.logger.warn("Kafka producer disconnected");
      this.setConnectionState("reconnecting");
    });

    const unsubConnect = producer.on(producer.events.CONNECT, () => {
      if (this._deliberateDisconnect) return;
      if (this.getConnectionState() === "reconnecting") {
        this.logger.info("Kafka producer reconnected");
        this.setConnectionState("connected");

        // Consumers can die on a broker bounce without KafkaJS restarting
        // them, so re-establish every registered consumer. Guarded by the
        // in-flight promise to avoid overlapping replays if CONNECT fires
        // more than once.
        this.triggerReRegister(() => reRegisterKafkaConsumers(this.state, this.logger));
      }
    });

    this._producerUnsubscribers.push(unsubDisconnect, unsubConnect);
  }
}
