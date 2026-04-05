import {
  CorrelationField,
  DeadLetter,
  Field,
  IdentifierField,
  Message,
  Namespace,
  Retry,
  TimestampField,
  Topic,
} from "@lindorm/iris";

@Namespace("pylon")
@Message()
@Topic(() => "pylon.audit.request")
@Retry({ maxRetries: 5, strategy: "exponential", delay: 1000 })
@DeadLetter()
export class RequestAudit {
  @IdentifierField()
  public readonly id!: string;

  @CorrelationField()
  public readonly correlationId!: string;

  @TimestampField()
  public readonly timestamp!: Date;

  @Field("string")
  public readonly requestId!: string;

  @Field("string")
  public readonly actor!: string;

  @Field("string")
  public readonly appName!: string;

  @Field("string")
  public readonly endpoint!: string;

  @Field("string")
  public readonly method!: string;

  @Field("string")
  public readonly transport!: string;

  @Field("integer")
  public readonly statusCode!: number;

  @Field("integer")
  public readonly duration!: number;

  @Field("string")
  public readonly sourceIp!: string;

  @Field("object", { nullable: true })
  public readonly requestBody!: Record<string, unknown> | null;

  @Field("string", { nullable: true })
  public readonly sessionId!: string | null;

  @Field("string", { nullable: true })
  public readonly userAgent!: string | null;
}
