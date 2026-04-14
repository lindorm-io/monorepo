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
export class RequestAuditLog {
  @PrimaryKeyField()
  public id!: string;

  @CreateDateField()
  public createdAt!: Date;

  @Index()
  @Field("string")
  public requestId!: string;

  @Index()
  @Field("string")
  public correlationId!: string;

  @Index()
  @Field("string")
  public actor!: string;

  @Field("string")
  public appName!: string;

  @Index()
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
