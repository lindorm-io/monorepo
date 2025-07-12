import { Constructor } from "@lindorm/types";
import { FindSubscriptionFilter, RemoveSubscriptionFilter } from "../types";
import { IMessage } from "./Message";
import { IMessageSubscription } from "./MessageSubscription";

export interface IMessageSubscriptions {
  subscriptions: Array<IMessageSubscription>;

  all(target: Constructor<IMessage>): Array<IMessageSubscription>;
  add(subscription: IMessageSubscription): void;
  find(criteria: FindSubscriptionFilter): IMessageSubscription | undefined;
  remove(criteria: RemoveSubscriptionFilter): void;
}
