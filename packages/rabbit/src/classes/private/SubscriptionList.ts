import { IMessage } from "@lindorm/message";
import { Constructor } from "@lindorm/types";
import {
  FindSubscription,
  RabbitSubscriptionItem,
  RemoveSubscription,
} from "../../types";

export class SubscriptionList {
  private _subscriptions: Array<RabbitSubscriptionItem>;

  public constructor() {
    this._subscriptions = [];
  }

  public get subscriptions(): Array<RabbitSubscriptionItem> {
    return this._subscriptions;
  }

  public all(Message: Constructor<IMessage>): Array<RabbitSubscriptionItem> {
    return this._subscriptions.filter((x) => x.Message === Message);
  }

  public add(subscription: RabbitSubscriptionItem): void {
    this._subscriptions.push(subscription);
  }

  public find(criteria: FindSubscription): RabbitSubscriptionItem | undefined {
    return this._subscriptions.find(
      (x) =>
        x.subscription.queue === criteria.queue &&
        x.subscription.topic === criteria.topic,
    );
  }

  public remove(criteria: RemoveSubscription): void {
    this._subscriptions = this._subscriptions.filter(
      (x) => x.consumerTag !== criteria.consumerTag,
    );
  }
}
