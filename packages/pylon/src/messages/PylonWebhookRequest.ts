import { Field, Message, MessageBase, Topic } from "@lindorm/message";
import { Dict } from "@lindorm/types";
import { WEBHOOK_REQUEST_TOPIC } from "../constants/private";
import { IWebhookRequest } from "../interfaces";

@Message()
@Topic((_) => WEBHOOK_REQUEST_TOPIC)
export class PylonWebhookRequest extends MessageBase implements IWebhookRequest {
  @Field("string")
  public readonly event!: string;

  @Field("object")
  public readonly payload!: Dict;
}
