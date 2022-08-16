import { IAmqpConnection, IMessageBus } from "@lindorm-io/amqp";
import { MessageBusType } from "../enum";

export interface MessageBusOptions {
  amqp?: IAmqpConnection;
  custom?: IMessageBus;
  type: MessageBusType;
}
