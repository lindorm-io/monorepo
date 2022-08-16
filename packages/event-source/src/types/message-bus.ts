import { IAmqpConnection, IMessageBus } from "@lindorm-io/amqp";

export type MessageBusQueue = "amqp" | "custom";

export interface MessageBusOptions {
  amqp?: IAmqpConnection;
  custom?: IMessageBus;
  type: MessageBusQueue;
}
