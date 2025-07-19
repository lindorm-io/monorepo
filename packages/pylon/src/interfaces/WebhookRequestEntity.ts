import { Dict } from "@lindorm/types";
import { IQueueableEntity } from "./QueueableEntity";

export interface IWebhookRequest {
  event: string;
  payload: Dict;
}

export interface IWebhookRequestEntity extends IWebhookRequest, IQueueableEntity {}
