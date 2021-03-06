import { AmqpConnection } from "../connection";
import { ILogger } from "@lindorm-io/winston";
import { IMessage } from "./message";
import { ISubscription } from "./subscription";

export interface IMessageBus<
  Message extends IMessage = IMessage,
  Subscription extends ISubscription = ISubscription,
> {
  publish(messages: Array<Message>): Promise<void>;
  subscribe(subscriptions: Array<Subscription>): Promise<void>;
}

export interface BusOptions {
  nackTimeout?: number;
}

export interface MessageBusOptions {
  connection: AmqpConnection;
  logger: ILogger;
}

export type LindormMessageBusOptions = BusOptions & MessageBusOptions;
