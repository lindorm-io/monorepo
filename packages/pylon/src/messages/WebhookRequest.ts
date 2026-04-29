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
  public readonly correlationId!: string;

  @Field("string")
  public readonly event!: string;

  @Field("object")
  public readonly payload!: Dict;

  @Nullable()
  @Field("string")
  public readonly tenantId!: string | null;
}
