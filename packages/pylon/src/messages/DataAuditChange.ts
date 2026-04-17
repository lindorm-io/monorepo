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
@Topic(() => "pylon.audit.data")
@Retry({ maxRetries: 5, strategy: "exponential", delay: 1000 })
@DeadLetter()
export class DataAuditChange {
  @IdentifierField()
  public readonly id!: string;

  @CorrelationField()
  public readonly correlationId!: string;

  @TimestampField()
  public readonly timestamp!: Date;

  @Field("string")
  public readonly actor!: string;

  @Field("string")
  public readonly entityName!: string;

  @Nullable()
  @Field("string")
  public readonly entityNamespace!: string | null;

  @Field("string")
  public readonly entityId!: string;

  @Field("string")
  public readonly action!: string;

  @Nullable()
  @Field("object")
  public readonly changes!: Record<string, { from: unknown; to: unknown }> | null;
}
