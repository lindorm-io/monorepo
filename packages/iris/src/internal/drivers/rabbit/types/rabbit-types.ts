import type { Channel, ChannelModel, ConfirmChannel, Options } from "amqplib";
import type { IrisEnvelope } from "../../../types/iris-envelope.js";

export type AmqpPublishConfig = {
  properties: Options.Publish;
  routingKey: string;
};

export type ParsedAmqpMessage = {
  payload: Buffer;
  headers: Record<string, string>;
  envelope: Partial<IrisEnvelope>;
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
