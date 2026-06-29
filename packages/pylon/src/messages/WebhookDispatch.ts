import { CorrelationField, Field, Message, Namespace, Topic } from "@lindorm/iris";
import type { Dict } from "@lindorm/types";
import type { IWebhookSubscription } from "../interfaces/index.js";

@Namespace("pylon")
@Message()
@Topic(() => "pylon.webhook.dispatch")
export class WebhookDispatch {
  @CorrelationField()
  readonly correlationId!: string;

  @Field("string")
  readonly event!: string;

  @Field("object")
  readonly payload!: Dict;

  @Field("object")
  readonly subscription!: IWebhookSubscription;
}
