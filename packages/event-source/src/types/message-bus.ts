import { IAmqpConnection, IMessageBus } from "@lindorm-io/amqp";

export type MessageBusType = "amqp" | "custom";

export interface MessageBusOptions {
  amqp?: IAmqpConnection;
  custom?: IMessageBus;
  type: MessageBusType;
}
