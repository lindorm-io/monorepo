import { IMessage } from "./message";
import { ISubscription } from "./subscription";

export type MessageBusOptions = {
  nackTimeout?: number;
};

export type SubscriptionData<Subscription extends ISubscription = ISubscription> = {
  queue: string;
  topic: string;
  consumerTag: string;
  subscription: Subscription;
};

export type UnsubscribeOptions = {
  queue: string;
  topic: string;
};

export interface IMessageBus<
  Message extends IMessage = IMessage,
  Subscription extends ISubscription = ISubscription,
> {
  publish(messages: Message | Array<Message>): Promise<void>;
  subscribe(subscriptions: Subscription | Array<Subscription>): Promise<void>;
  unsubscribe(subscriptions: UnsubscribeOptions | Array<UnsubscribeOptions>): Promise<void>;
  unsubscribeAll(): Promise<void>;
}
