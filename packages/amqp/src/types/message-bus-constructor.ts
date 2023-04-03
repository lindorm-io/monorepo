import { IAmqpConnection } from "./amqp-connection";
import { Logger } from "@lindorm-io/core-logger";
import { IMessageBus } from "./message-bus";
import { IMessage } from "./message";
import { ISubscription } from "./subscription";

export type MessageBusConstructor<
  Message extends IMessage = IMessage,
  Subscription extends ISubscription = ISubscription,
> = new (connection: IAmqpConnection, logger: Logger) => IMessageBus<Message, Subscription>;
