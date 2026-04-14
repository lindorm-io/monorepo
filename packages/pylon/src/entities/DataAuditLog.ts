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
@Entity()
export class DataAuditLog {
  @PrimaryKeyField()
  public id!: string;

  @CreateDateField()
  public createdAt!: Date;

  @Index()
  @Field("string")
  public correlationId!: string;

  @Index()
  @Field("string")
  public actor!: string;

  @Index()
  @Field("string")
  public entityName!: string;

  @Nullable()
  @Field("string")
  public entityNamespace!: string | null;

  @Index()
  @Field("string")
  public entityId!: string;

  @Field("string")
  public action!: string;

  @Nullable()
  @Field("json")
  public changes!: Record<string, { from: unknown; to: unknown }> | null;
}
