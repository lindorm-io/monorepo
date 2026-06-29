import {
  CreateDateField,
  Entity,
  Field,
  Generated,
  Index,
  Namespace,
  Nullable,
  PrimaryKeyField,
} from "@lindorm/proteus";

@Namespace("pylon")
@Entity()
export class DataAuditLog {
  @PrimaryKeyField()
  @Generated("lindorm_id", { namespace: "dau" })
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

  @Nullable()
  @Field("json")
  changes!: Record<string, { from: unknown; to: unknown }> | null;
}
