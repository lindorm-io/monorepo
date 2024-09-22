import {
  FindSubscription,
  RabbitSubscriptionItem,
  RemoveSubscription,
} from "../../types";

export class SubscriptionList {
  private subscriptions: Array<RabbitSubscriptionItem>;

  public constructor() {
    this.subscriptions = [];
  }

  public get all(): Array<RabbitSubscriptionItem> {
    return this.subscriptions;
  }

  public add(subscription: RabbitSubscriptionItem): void {
    this.subscriptions.push(subscription);
  }

  public find(criteria: FindSubscription): RabbitSubscriptionItem | undefined {
    return this.subscriptions.find(
      (x) => x.queue === criteria.queue && x.topic === criteria.topic,
    );
  }

  public remove(criteria: RemoveSubscription): void {
    this.subscriptions = this.subscriptions.filter(
      (x) => x.consumerTag !== criteria.consumerTag,
    );
  }
}
