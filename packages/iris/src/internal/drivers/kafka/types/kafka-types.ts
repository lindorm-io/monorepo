import type { ILogger } from "@lindorm/logger";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager.js";
import type { DelayManager } from "../../../delay/DelayManager.js";

export type CreateKafkaConsumerOptions = {
  kafka: KafkaClient;
  groupId: string;
  topic: string;
  onMessage: (payload: KafkaEachMessagePayload) => Promise<void>;
  sessionTimeoutMs?: number;
  logger: ILogger;
  fromBeginning?: boolean;
  abortSignal?: AbortSignal;
  /**
   * Upper bound on how many partitions the consumer processes concurrently
   * (maps to KafkaJS `partitionsConsumedConcurrently`). This is the Kafka
   * expression of the driver's `prefetch` setting — the other drivers bound
   * consumer concurrency by prefetch, Kafka does it per-partition. Clamped to
   * a minimum of 1. Ordering is unaffected: KafkaJS still processes each single
   * partition serially, so per-key ordering (the `@IdentifierField` partition
   * key) is preserved; only distinct partitions run in parallel.
   */
  prefetch?: number;
  /**
   * Reuse an existing consumer tag instead of minting a new one. Used when
   * re-establishing a consumer on reconnect so the owning instance's cached
   * tag stays valid (see reRegisterKafkaConsumers).
   */
  consumerTag?: string;
};

export type GetOrCreatePooledConsumerOptions = {
  state: KafkaSharedState;
  groupId: string;
  topic: string;
  onMessage: (payload: KafkaEachMessagePayload) => Promise<void>;
  logger: ILogger;
  fromBeginning?: boolean;
};

export type WrapKafkaConsumerOptions = {
  deadLetterManager?: DeadLetterManager;
  delayManager?: DelayManager;
  consumer: KafkaConsumer | (() => KafkaConsumer);
};

export type ReleasePooledConsumerOptions = {
  state: KafkaSharedState;
  groupId: string;
  topic: string;
  logger: ILogger;
};

export type PublishKafkaMessagesOptions = {
  delayManager?: DelayManager;
};

export type GroupIdOptions = {
  prefix: string;
  topic?: string;
  queue?: string;
  type: "subscribe" | "worker" | "rpc";
  generation?: number;
};

export type KafkaClient = {
  producer: () => KafkaProducer;
  consumer: (opts: { groupId: string; sessionTimeout?: number }) => KafkaConsumer;
  admin: () => KafkaAdmin;
};

export type KafkaProducerEvents = {
  CONNECT: string;
  DISCONNECT: string;
};

export type KafkaProducer = {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  send: (record: {
    topic: string;
    messages: Array<KafkaMessage>;
    acks?: number;
  }) => Promise<void>;
  on: (event: string, listener: (payload: unknown) => void) => () => void;
  events: KafkaProducerEvents;
};

export type KafkaMessage = {
  key?: string | Buffer | null;
  value: Buffer | null;
  headers?: Record<string, string | Buffer | undefined>;
};

export type KafkaConsumerEvents = {
  GROUP_JOIN: string;
  HEARTBEAT: string;
  COMMIT_OFFSETS: string;
  STOP: string;
  DISCONNECT: string;
  CONNECT: string;
  FETCH_START: string;
  FETCH: string;
  START_BATCH_PROCESS: string;
  END_BATCH_PROCESS: string;
  CRASH: string;
  RECEIVED_UNSUBSCRIBED_TOPICS: string;
  REQUEST_TIMEOUT: string;
};

export type KafkaConsumer = {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  subscribe: (opts: { topic: string | RegExp; fromBeginning?: boolean }) => Promise<void>;
  run: (opts: {
    eachMessage: (payload: KafkaEachMessagePayload) => Promise<void>;
    autoCommit?: boolean;
    partitionsConsumedConcurrently?: number;
  }) => Promise<void>;
  pause: (topics: Array<{ topic: string }>) => void;
  resume: (topics: Array<{ topic: string }>) => void;
  seek: (topicPartitionOffset: {
    topic: string;
    partition: number;
    offset: string;
  }) => void;
  stop: () => Promise<void>;
  commitOffsets: (
    offsets: Array<{ topic: string; partition: number; offset: string }>,
  ) => Promise<void>;
  on: (event: string, listener: (payload: unknown) => void) => () => void;
  events: KafkaConsumerEvents;
};

export type KafkaAdmin = {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  listTopics: () => Promise<Array<string>>;
  createTopics: (opts: {
    topics: Array<{
      topic: string;
      numPartitions?: number;
      replicationFactor?: number;
    }>;
    waitForLeaders?: boolean;
  }) => Promise<boolean>;
  deleteTopics: (opts: { topics: Array<string> }) => Promise<void>;
  fetchTopicOffsets: (
    topic: string,
  ) => Promise<Array<{ partition: number; offset: string; high: string; low: string }>>;
};

export type KafkaEachMessagePayload = {
  topic: string;
  partition: number;
  message: {
    key: Buffer | null;
    value: Buffer | null;
    headers?: Record<string, Buffer | undefined>;
    offset: string;
    timestamp: string;
  };
  heartbeat: () => Promise<void>;
};

export type KafkaSharedState = {
  kafka: KafkaClient | null;
  producer: KafkaProducer | null;
  admin: KafkaAdmin | null;
  connectionConfig: {
    brokers: Array<string>;
  } & import("../../../../types/index.js").KafkaConnectionOptions;
  acks: number;
  prefix: string;
  consumers: Array<KafkaConsumerHandle>;
  consumerRegistrations: Array<KafkaConsumerRegistration>;
  consumerPool: Map<string, KafkaPooledConsumer>;
  inFlightCount: number;
  prefetch: number;
  sessionTimeoutMs: number;
  createdTopics: Set<string>;
  publishedTopics: Set<string>;
  abortController: AbortController;
  resetGeneration: number;
};

export type KafkaConsumerHandle = {
  consumerTag: string;
  groupId: string;
  topic: string;
  consumer: KafkaConsumer;
};

export type KafkaConsumerRegistration = {
  consumerTag: string;
  groupId: string;
  topic: string;
  /**
   * The real consumer handler, replayed verbatim on reconnect. Must NOT be a
   * no-op: the registry is the sole source of truth for re-establishing this
   * consumer after a broker bounce (see reRegisterKafkaConsumers).
   */
  onMessage: (payload: KafkaEachMessagePayload) => Promise<void>;
  /**
   * `true` for consumers created via the shared consumer pool (message bus,
   * worker queue, RPC server); `false` for dedicated consumers (stream
   * pipeline). Decides which factory rebuilds the consumer on reconnect.
   */
  pooled: boolean;
  fromBeginning?: boolean;
};

export type KafkaPooledConsumer = {
  consumer: KafkaConsumer;
  groupId: string;
  topics: Set<string>;
  callbacks: Map<string, Array<(payload: KafkaEachMessagePayload) => Promise<void>>>;
  roundRobinCounters: Map<string, number>;
  refCount: number;
  localAbort: AbortController;
};
