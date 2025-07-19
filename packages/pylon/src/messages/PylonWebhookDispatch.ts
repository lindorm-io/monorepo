import { Field, Message, MessageBase, Topic } from "@lindorm/message";
import { Dict } from "@lindorm/types";
import { WEBHOOK_DISPATCH_TOPIC } from "../constants/private";
import { IWebhookDispatch, IWebhookSubscription } from "../interfaces";

@Message()
@Topic((_) => WEBHOOK_DISPATCH_TOPIC)
export class PylonWebhookDispatch extends MessageBase implements IWebhookDispatch {
  @Field("string")
  public readonly event!: string;

  @Field("object")
  public readonly payload!: Dict;

  @Field("object")
  public readonly subscription!: IWebhookSubscription;
}
