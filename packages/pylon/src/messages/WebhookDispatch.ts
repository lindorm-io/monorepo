import { CorrelationField, Field, Message, Namespace, Topic } from "@lindorm/iris";
import type { Dict } from "@lindorm/types";

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

  // The subscription is carried by ID only — never the full row. Its
  // `clientSecret` is an at-rest `@Encrypted` column, so putting the object here
  // (proteus decrypts on read) would leak the plaintext secret onto the broker.
  // The dispatch consumer reloads by id and decrypts locally at fan-out.
  @Field("string")
  readonly subscriptionId!: string;
}
