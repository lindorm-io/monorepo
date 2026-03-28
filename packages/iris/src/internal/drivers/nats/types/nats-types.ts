import type { ILogger } from "@lindorm/logger";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager";
import type { DelayManager } from "../../../delay/DelayManager";
export type CreateNatsConsumerOptions = {
  js: NatsJetStreamClient;
  jsm: NatsJetStreamManager;
  streamName: string;
  consumerName: string;
  subject: string;
  prefetch: number;
  onMessage: (msg: NatsJsMsg) => Promise<void>;
  logger: ILogger;
  ensuredConsumers: Set<string>;
  deliverPolicy?: "all" | "new";
};

export type WrapNatsConsumerOptions = {
  deadLetterManager?: DeadLetterManager;
};

export type PublishNatsMessagesOptions = {
  delayManager?: DelayManager;
};

export type ConsumerNameOptions = {
  prefix: string;
  topic: string;
  queue?: string;
  type: "subscribe" | "worker" | "rpc";
};

export type SerializedNatsMessage = {
  data: Uint8Array;
  headers?: NatsMsgHeaders;
};

export type EnsureNatsStreamOptions = {
  jsm: NatsJetStreamManager;
  streamName: string;
  subjects: Array<string>;
  logger: ILogger;
};

// -- Duck types for the nats library (no direct nats imports) -----------------

export type NatsMsgHeaders = {
  get: (key: string) => string;
  set: (key: string, value: string) => void;
  has: (key: string) => boolean;
  values: (key: string) => Array<string>;
};

export type NatsMsg = {
  data: Uint8Array;
  headers?: NatsMsgHeaders;
  subject: string;
  reply?: string;
  sid: number;
  respond: (data?: Uint8Array, opts?: { headers?: NatsMsgHeaders }) => boolean;
};

export type NatsJsMsg = {
  data: Uint8Array;
  headers?: NatsMsgHeaders;
  subject: string;
  seq: number;
  info: {
    stream: string;
    consumer: string;
    redelivered: boolean;
    deliveryCount: number;
  };
  ack: () => void;
  nak: (millis?: number) => void;
  working: () => void;
  term: (reason?: string) => void;
};

export type NatsPubAck = {
  stream: string;
  seq: number;
  duplicate: boolean;
};

export type NatsConsumerMessages = AsyncIterable<NatsJsMsg> & {
  close: () => Promise<void | Error>;
  closed: () => Promise<void | Error>;
};

export type NatsConsumer = {
  consume: (opts?: {
    max_messages?: number;
    expires?: number;
    idle_heartbeat?: number;
  }) => Promise<NatsConsumerMessages>;
  info: (cached?: boolean) => Promise<NatsConsumerInfo>;
  delete: () => Promise<boolean>;
};

export type NatsConsumerInfo = {
  name: string;
  config: Record<string, unknown>;
  num_pending: number;
  num_ack_pending: number;
};

export type NatsStreamAPI = {
  add: (cfg: Record<string, unknown>) => Promise<unknown>;
  info: (name: string) => Promise<unknown>;
  purge: (name: string) => Promise<unknown>;
  delete: (name: string) => Promise<boolean>;
};

export type NatsConsumerAPI = {
  add: (stream: string, cfg: Record<string, unknown>) => Promise<NatsConsumerInfo>;
  delete: (stream: string, consumer: string) => Promise<boolean>;
};

export type NatsJetStreamManager = {
  streams: NatsStreamAPI;
  consumers: NatsConsumerAPI;
};

export type NatsJetStreamClient = {
  publish: (
    subject: string,
    data?: Uint8Array,
    opts?: {
      headers?: NatsMsgHeaders;
      msgID?: string;
      timeout?: number;
    },
  ) => Promise<NatsPubAck>;
  consumers: {
    get: (stream: string, consumer: string) => Promise<NatsConsumer>;
  };
};

export type NatsSubscription = {
  unsubscribe: () => void;
  drain: () => Promise<void>;
  isClosed: boolean;
};

export type NatsConnection = {
  jetstream: () => NatsJetStreamClient;
  jetstreamManager: () => Promise<NatsJetStreamManager>;
  publish: (
    subject: string,
    data?: Uint8Array,
    opts?: { headers?: NatsMsgHeaders; reply?: string },
  ) => void;
  subscribe: (
    subject: string,
    opts?: {
      queue?: string;
      callback?: (err: Error | null, msg: NatsMsg) => void;
    },
  ) => NatsSubscription;
  request: (
    subject: string,
    data?: Uint8Array,
    opts?: { timeout?: number; headers?: NatsMsgHeaders },
  ) => Promise<NatsMsg>;
  flush: () => Promise<void>;
  close: () => Promise<void>;
  drain: () => Promise<void>;
  status: () => AsyncIterable<{ type: string; data?: string }>;
  isClosed: () => boolean;
};

export type HeadersInit = () => NatsMsgHeaders;

// -- Consumer loop types ------------------------------------------------------

export type NatsConsumerLoop = {
  consumerTag: string;
  streamName: string;
  consumerName: string;
  subject: string;
  messages: NatsConsumerMessages | null;
  abortController: AbortController;
  loopPromise: Promise<void>;
  ready: Promise<void>;
};

export type NatsConsumerRegistration = {
  consumerTag: string;
  streamName: string;
  consumerName: string;
  subject: string;
  callback: (msg: NatsJsMsg) => Promise<void>;
  deliverPolicy: "all" | "new";
};

// -- Shared state -------------------------------------------------------------

export type NatsSharedState = {
  nc: NatsConnection | null;
  js: NatsJetStreamClient | null;
  jsm: NatsJetStreamManager | null;
  headersInit: HeadersInit | null;
  prefix: string;
  streamName: string;
  consumerLoops: Array<NatsConsumerLoop>;
  consumerRegistrations: Array<NatsConsumerRegistration>;
  ensuredConsumers: Set<string>;
  inFlightCount: number;
  prefetch: number;
};
