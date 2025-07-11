import { Constructor } from "@lindorm/types";
import { IMessage, IMessageSubscription, IMessageSubscriptions } from "../interfaces";
import { FindSubscriptionFilter, RemoveSubscriptionFilter } from "../types";

export class MessageSubscriptions implements IMessageSubscriptions {
  private _subscriptions: Array<IMessageSubscription>;

  public constructor() {
    this._subscriptions = [];
  }

  public get subscriptions(): Array<IMessageSubscription> {
    return this._subscriptions;
  }

  public all(Message: Constructor<IMessage>): Array<IMessageSubscription> {
    return this._subscriptions.filter((x) => x.target === Message);
  }

  public add(subscription: IMessageSubscription): void {
    this._subscriptions.push(subscription);
  }

  public find(criteria: FindSubscriptionFilter): IMessageSubscription | undefined {
    return this._subscriptions.find(
      (x) => x.queue === criteria.queue && x.topic === criteria.topic,
    );
  }

  public remove(criteria: RemoveSubscriptionFilter): void {
    this._subscriptions = this._subscriptions.filter(
      (x) => x.consumerTag !== criteria.consumerTag,
    );
  }
}
