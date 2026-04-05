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
@Index<typeof RequestAuditLog>(["actor"])
@Index<typeof RequestAuditLog>(["endpoint"])
@Index<typeof RequestAuditLog>(["correlationId"])
@Index<typeof RequestAuditLog>(["requestId"])
@Entity({ name: "request_audit_log" })
export class RequestAuditLog {
  @PrimaryKeyField()
  public id!: string;

  @CreateDateField()
  public createdAt!: Date;

  @Field("string")
  public requestId!: string;

  @Field("string")
  public correlationId!: string;

  @Field("string")
  public actor!: string;

  @Field("string")
  public appName!: string;

  @Field("string")
  public endpoint!: string;

  @Field("string")
  public method!: string;

  @Field("string")
  public transport!: string;

  @Field("integer")
  public statusCode!: number;

  @Field("integer")
  public duration!: number;

  @Field("string")
  public sourceIp!: string;

  @Nullable()
  @Field("json")
  public requestBody!: Record<string, unknown> | null;

  @Nullable()
  @Field("string")
  public sessionId!: string | null;

  @Nullable()
  @Field("string")
  public userAgent!: string | null;
}
