import { IAmqpConnection, IMessageBus } from "@lindorm-io/amqp";

export type MessageBusQueueType = "amqp" | "custom";

export interface MessageBusOptions {
  amqp?: IAmqpConnection;
  custom?: IMessageBus;
  type: MessageBusQueueType;
}
