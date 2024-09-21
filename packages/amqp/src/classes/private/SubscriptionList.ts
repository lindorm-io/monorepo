import { FindSubscription, RemoveSubscription, SubscriptionData } from "../../types";

export class SubscriptionList {
  private subscriptions: Array<SubscriptionData>;

  public constructor() {
    this.subscriptions = [];
  }

  public get all(): Array<SubscriptionData> {
    return this.subscriptions;
  }

  public add(subscription: SubscriptionData): void {
    this.subscriptions.push(subscription);
  }

  public find(criteria: FindSubscription): SubscriptionData | undefined {
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
