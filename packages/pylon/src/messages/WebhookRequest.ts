import {
  CorrelationField,
  Field,
  Message,
  Namespace,
  Nullable,
  Topic,
} from "@lindorm/iris";
import type { Dict } from "@lindorm/types";

@Namespace("pylon")
@Message()
@Topic(() => "pylon.webhook.request")
export class WebhookRequest {
  @CorrelationField()
  readonly correlationId!: string;

  @Field("string")
  readonly event!: string;

  @Field("object")
  readonly payload!: Dict;

  @Nullable()
  @Field("string")
  readonly tenantId!: string | null;
}
