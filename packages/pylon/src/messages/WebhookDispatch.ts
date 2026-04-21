import { CorrelationField, Field, Message, Namespace, Topic } from "@lindorm/iris";
import type { Dict } from "@lindorm/types";
import type { IWebhookSubscription } from "../interfaces/index.js";

@Namespace("pylon")
@Message()
@Topic(() => "pylon.webhook.dispatch")
export class WebhookDispatch {
  @CorrelationField()
  public readonly correlationId!: string;

  @Field("string")
  public readonly event!: string;

  @Field("object")
  public readonly payload!: Dict;

  @Field("object")
  public readonly subscription!: IWebhookSubscription;
}
