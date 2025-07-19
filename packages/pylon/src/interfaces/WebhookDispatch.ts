import { Dict } from "@lindorm/types";
import { IQueueableEntity } from "./QueueableEntity";
import { IWebhookSubscription } from "./WebhookSubscriptionEntity";

export interface IWebhookDispatch {
  event: string;
  payload: Dict;
  subscription: IWebhookSubscription;
}

export interface IWebhookDispatchEntity extends IWebhookDispatch, IQueueableEntity {}
