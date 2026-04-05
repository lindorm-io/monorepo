import {
  AppendOnly,
  CreateDateField,
  Default,
  Entity,
  Field,
  Index,
  Namespace,
  Nullable,
  PrimaryKeyField,
  Unique,
} from "@lindorm/proteus";

@Namespace("hermes")
@AppendOnly()
@Unique<typeof EventRecord>([
  "aggregateId",
  "aggregateName",
  "aggregateNamespace",
  "expectedEvents",
])
@Entity({ name: "event" })
export class EventRecord {
  @PrimaryKeyField()
  public id: string = "";

  @Field("string")
  @Index()
  public aggregateId: string = "";

  @Field("string")
  public aggregateName: string = "";

  @Field("string")
  public aggregateNamespace: string = "";

  @Field("string")
  public causationId: string = "";

  @Field("string")
  public correlationId: string = "";

  @Field("string")
  public checksum: string = "";

  @Field("jsonb")
  public data: Record<string, unknown> = {};

  @Field("boolean")
  @Default(false)
  public encrypted: boolean = false;

  @Field("string")
  public name: string = "";

  @Field("date")
  public timestamp: Date = new Date();

  @Field("integer")
  public expectedEvents: number = 0;

  @Field("jsonb")
  public meta: Record<string, unknown> = {};

  @Field("string")
  @Nullable()
  public previousId: string | null = null;

  @Field("integer")
  public version: number = 0;

  @CreateDateField()
  public createdAt: Date = new Date();
}
