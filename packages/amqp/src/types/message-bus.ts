import { AmqpConnection } from "../connection";
import { ILogger } from "@lindorm-io/winston";
import { IMessage } from "./message";
import { ISubscription } from "./subscription";

export interface BusOptions {
  nackTimeout?: number;
}

export interface MessageBusOptions {
  connection: AmqpConnection;
  logger: ILogger;
}

export type LindormMessageBusOptions = BusOptions & MessageBusOptions;

export interface SubscriptionData<Subscription extends ISubscription = ISubscription> {
  queue: string;
  routingKey: string;
  consumerTag: string;
  subscription: Subscription;
}

export interface UnsubscribeOptions {
  queue: string;
  routingKey: string;
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
