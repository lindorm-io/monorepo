import {
  CreateDateField,
  Entity,
  Field,
  Index,
  Namespace,
  Nullable,
  PrimaryKeyField,
} from "@lindorm/proteus";

@Namespace("pylon")
@Entity({ name: "data_audit_log" })
@Index<typeof DataAuditLog>(["correlationId"])
@Index<typeof DataAuditLog>(["actor"])
@Index<typeof DataAuditLog>(["entityName"])
@Index<typeof DataAuditLog>(["entityId"])
export class DataAuditLog {
  @PrimaryKeyField()
  public id!: string;

  @CreateDateField()
  public createdAt!: Date;

  @Field("string")
  public correlationId!: string;

  @Field("string")
  public actor!: string;

  @Field("string")
  public entityName!: string;

  @Nullable()
  @Field("string")
  public entityNamespace!: string | null;

  @Field("string")
  public entityId!: string;

  @Field("string")
  public action!: string;

  @Nullable()
  @Field("json")
  public changes!: Record<string, { from: unknown; to: unknown }> | null;
}
