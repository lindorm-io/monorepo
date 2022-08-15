import { IAmqpConnection } from "./amqp-connection";
import { ILogger } from "@lindorm-io/winston";
import { IMessage } from "./message";
import { ISubscription } from "./subscription";

export interface BusOptions {
  nackTimeout?: number;
}

export interface MessageBusOptions {
  connection: IAmqpConnection;
  logger: ILogger;
}

export type LindormMessageBusOptions = BusOptions & MessageBusOptions;

export interface SubscriptionData<Subscription extends ISubscription = ISubscription> {
  queue: string;
  topic: string;
  consumerTag: string;
  subscription: Subscription;
}

export interface UnsubscribeOptions {
  queue: string;
  topic: string;
}

export interface IMessageBus<
  Message extends IMessage = IMessage,
  Subscription extends ISubscription = ISubscription,
> {
  publish(messages: Message | Array<Message>): Promise<void>;
  subscribe(subscriptions: Subscription | Array<Subscription>): Promise<void>;
  unsubscribe(subscriptions: UnsubscribeOptions | Array<UnsubscribeOptions>): Promise<void>;
  unsubscribeAll(): Promise<void>;
}
