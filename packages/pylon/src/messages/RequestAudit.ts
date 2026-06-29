import {
  CorrelationField,
  DeadLetter,
  Field,
  IdentifierField,
  Message,
  Namespace,
  Nullable,
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
  readonly id!: string;

  @CorrelationField()
  readonly correlationId!: string;

  @TimestampField()
  readonly timestamp!: Date;

  @Field("string")
  readonly requestId!: string;

  @Field("string")
  readonly actor!: string;

  @Field("string")
  readonly appName!: string;

  @Field("string")
  readonly endpoint!: string;

  @Field("string")
  readonly method!: string;

  @Field("string")
  readonly transport!: string;

  @Field("integer")
  readonly statusCode!: number;

  @Field("integer")
  readonly duration!: number;

  @Field("string")
  readonly sourceIp!: string;

  @Nullable()
  @Field("object")
  readonly requestBody!: Record<string, unknown> | null;

  @Nullable()
  @Field("string")
  readonly sessionId!: string | null;

  @Nullable()
  @Field("string")
  readonly userAgent!: string | null;
}
