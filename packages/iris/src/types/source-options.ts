import type { IAmphora } from "@lindorm/amphora";
import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { ConnectionOptions } from "node:tls";
import type { IDeadLetterStore } from "../interfaces/IrisDeadLetterStore.js";
import type { IDelayStore } from "../interfaces/IrisDelayStore.js";
import type { IMessage } from "../interfaces/index.js";

export type IrisDriverType = "memory" | "rabbit" | "kafka" | "nats" | "redis";

export type MessageScannerInput = Array<Constructor<IMessage> | string>;

export type SessionOptions = {
  logger?: ILogger;
  context?: unknown;
};

export type IrisPersistenceDelayConfig =
  | { type: "memory"; pollIntervalMs?: number }
  | { type: "redis"; url: string; pollIntervalMs?: number }
  | { type: "custom"; store: IDelayStore; pollIntervalMs?: number };

export type IrisPersistenceDeadLetterConfig =
  | { type: "memory" }
  | { type: "redis"; url: string }
  | { type: "custom"; store: IDeadLetterStore };

export type IrisPersistenceOptions = {
  redisUrl?: string;
  delay?: IrisPersistenceDelayConfig;
  deadLetter?: IrisPersistenceDeadLetterConfig;
};

export type IrisSourceOptionsBase = {
  messages?: MessageScannerInput;
  context?: unknown;
  logger: ILogger;
  amphora?: IAmphora;
  persistence?: IrisPersistenceOptions;
};

/**
 * Optional driver-specific connection tuning for Kafka (curated from kafkajs KafkaConfig).
 * The primary connection target (brokers) lives at the top level of IrisKafkaOptions.
 */
export type KafkaConnectionOptions = {
  clientId?: string;
  ssl?: boolean | ConnectionOptions;
  sasl?:
    | {
        mechanism: "plain" | "scram-sha-256" | "scram-sha-512";
        username: string;
        password: string;
      }
    | {
        mechanism: "aws";
        authorizationIdentity: string;
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
      }
    | {
        mechanism: "oauthbearer";
        oauthBearerProvider: () => Promise<{ value: string }>;
      };
  connectionTimeout?: number;
  requestTimeout?: number;
  retry?: {
    maxRetryTime?: number;
    initialRetryTime?: number;
    factor?: number;
    multiplier?: number;
    retries?: number;
  };
};

/**
 * Optional driver-specific connection tuning for RabbitMQ (curated from amqplib Options.Connect).
 * The primary connection target (url) lives at the top level of IrisRabbitOptions.
 */
export type RabbitConnectionOptions = {
  socketOptions?: {
    timeout?: number;
    keepAlive?: boolean;
    keepAliveDelay?: number;
    noDelay?: boolean;
    cert?: Buffer;
    key?: Buffer;
    pfx?: Buffer;
    passphrase?: string;
    ca?: Array<Buffer>;
  };
  heartbeat?: number;
};

/**
 * Optional driver-specific connection tuning for Redis (curated from ioredis RedisOptions).
 * The primary connection target (url) lives at the top level of IrisRedisOptions.
 */
export type RedisConnectionOptions = {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  tls?: ConnectionOptions;
  connectTimeout?: number;
  commandTimeout?: number;
  keepAlive?: number;
  connectionName?: string;
  enableReadyCheck?: boolean;
  maxRetriesPerRequest?: number | null;
  retryStrategy?: (times: number) => number | null;
};

export type IrisRabbitOptions = IrisSourceOptionsBase & {
  driver: "rabbit";
  url: string;
  connection?: RabbitConnectionOptions;
  exchange?: string;
  prefetch?: number;
};

export type IrisKafkaOptions = IrisSourceOptionsBase & {
  driver: "kafka";
  brokers: Array<string>;
  connection?: KafkaConnectionOptions;
  prefix?: string;
  prefetch?: number;
  sessionTimeoutMs?: number;
  acks?: -1 | 0 | 1;
};

/**
 * Optional driver-specific connection tuning for NATS (curated from nats.js ConnectionOptions).
 * The primary connection target (servers) lives at the top level of IrisNatsOptions.
 */
export type NatsConnectionOptions = {
  token?: string;
  user?: string;
  pass?: string;
  nkey?: string;
  nkeySeed?: string;
  tls?: ConnectionOptions | boolean;
  maxReconnectAttempts?: number;
  reconnectTimeWait?: number;
  timeout?: number;
  pingInterval?: number;
  name?: string;
  inboxPrefix?: string;
};

export type IrisNatsOptions = IrisSourceOptionsBase & {
  driver: "nats";
  servers: string | Array<string>;
  connection?: NatsConnectionOptions;
  prefix?: string;
  prefetch?: number;
};

export type IrisRedisOptions = IrisSourceOptionsBase & {
  driver: "redis";
  url?: string;
  connection?: RedisConnectionOptions;
  prefix?: string;
  prefetch?: number;
  blockMs?: number;
  maxStreamLength?: number | null;
};

export type IrisMemoryOptions = IrisSourceOptionsBase & {
  driver: "memory";
};

export type IrisSourceOptions =
  | IrisRabbitOptions
  | IrisKafkaOptions
  | IrisNatsOptions
  | IrisRedisOptions
  | IrisMemoryOptions;
