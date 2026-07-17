import type { Channel, ChannelModel, ConfirmChannel, Options } from "amqplib";

export type AmqpPublishConfig = {
  properties: Options.Publish;
  routingKey: string;
};

export type ParsedAmqpMessage = {
  payload: Buffer;
  /** User (non-`x-iris-*`) headers. */
  headers: Record<string, string>;
  /** Raw `x-iris-*` headers (string values) — decoded by build-rabbit-envelope. */
  irisHeaders: Record<string, string>;
  /** AMQP-native priority (`properties.priority`). */
  priority: number;
  /** AMQP-native timestamp (`properties.timestamp`). */
  timestamp: number;
  /** AMQP routing key (`fields.routingKey`) — the envelope topic. */
  routingKey: string;
};

export type QueueNameOptions = {
  exchange: string;
  topic: string;
  queue?: string;
  type: "subscribe" | "worker" | "rpc" | "delay";
};

export type RabbitConsumerRegistration = {
  queue: string;
  consumerTag: string;
  onMessage: (msg: any) => Promise<void>;
  routingKey?: string;
  exchange?: string;
  queueOptions?: Record<string, unknown>;
};

export type RabbitSharedState = {
  connection: ChannelModel | null;
  publishChannel: ConfirmChannel | null;
  consumeChannel: Channel | null;
  exchange: string;
  dlxExchange: string;
  dlqQueue: string;
  consumerRegistrations: Array<RabbitConsumerRegistration>;
  assertedQueues: Set<string>;
  assertedDelayQueues: Set<string>;
  replyConsumerTags: Array<string>;
  reconnecting: boolean;
  prefetch: number;
  inFlightCount: number;
};
