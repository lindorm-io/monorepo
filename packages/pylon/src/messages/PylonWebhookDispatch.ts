import { CorrelationField, Field, Message, Namespace, Topic } from "@lindorm/iris";
import { Dict } from "@lindorm/types";
import { IWebhookSubscription } from "../interfaces";

@Namespace("pylon")
@Message()
@Topic(() => "pylon.webhook.dispatch")
export class PylonWebhookDispatch {
  @CorrelationField()
  public readonly correlationId!: string;

  @Field("string")
  public readonly event!: string;

  @Field("object")
  public readonly payload!: Dict;

  @Field("object")
  public readonly subscription!: IWebhookSubscription;
}
