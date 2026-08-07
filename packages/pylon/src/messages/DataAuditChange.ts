import {
  CorrelationField,
  DeadLetter,
  Field,
  Generated,
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
@Topic("audit.data")
@Retry({ maxRetries: 5, strategy: "exponential", delay: 1000 })
@DeadLetter()
export class DataAuditChange {
  // ⚠ See `RequestAudit.id` — `@IdentifierField` generates nothing on its own,
  // so an unset `id` failed validation on every publish and the listener's
  // `.catch(log)` swallowed it.
  @IdentifierField()
  @Generated("lindorm_id", { namespace: "aud" })
  readonly id!: string;

  @CorrelationField()
  readonly correlationId!: string;

  @TimestampField()
  readonly timestamp!: Date;

  @Field("string")
  readonly actor!: string;

  @Field("string")
  readonly entityName!: string;

  @Nullable()
  @Field("string")
  readonly entityNamespace!: string | null;

  @Field("string")
  readonly entityId!: string;

  @Field("string")
  readonly action!: string;

  @Nullable()
  @Field("object")
  readonly changes!: Record<string, { from: unknown; to: unknown }> | null;
}
