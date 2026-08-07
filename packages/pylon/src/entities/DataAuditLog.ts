import {
  CreateDateField,
  Entity,
  Field,
  Generated,
  Index,
  Namespace,
  Nullable,
  PrimaryKeyField,
  TypedJson,
} from "@lindorm/proteus";

@Namespace("pylon")
@Entity()
export class DataAuditLog {
  @PrimaryKeyField()
  @Generated("lindorm_id", { namespace: "aud" })
  id!: string;

  @CreateDateField()
  createdAt!: Date;

  @Index()
  @Field("string")
  correlationId!: string;

  @Index()
  @Field("string")
  actor!: string;

  @Index()
  @Field("string")
  entityName!: string;

  @Nullable()
  @Field("string")
  entityNamespace!: string | null;

  @Index()
  @Field("string")
  entityId!: string;

  @Field("string")
  action!: string;

  // ⚠ `@TypedJson`, not plain json. A diff holds whatever the audited columns
  // hold, and any date column puts a `Date` in here — which a plain json field
  // REFUSES outright (`unserialisable_json`), so every audited update failed to
  // persist. The sidecar type column makes the round trip lossless instead of
  // flattening a Date to a string or rejecting a BigInt.
  @Nullable()
  @TypedJson()
  @Field("json")
  changes!: Record<string, { from: unknown; to: unknown }> | null;
}
