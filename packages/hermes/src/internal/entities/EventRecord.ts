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
  id: string = "";

  @Field("string")
  @Index()
  aggregateId: string = "";

  @Field("string")
  aggregateName: string = "";

  @Field("string")
  aggregateNamespace: string = "";

  @Field("string")
  causationId: string = "";

  @Field("string")
  correlationId: string = "";

  @Field("string")
  checksum: string = "";

  @Field("json")
  data: Record<string, unknown> = {};

  @Field("boolean")
  @Default(false)
  encrypted: boolean = false;

  @Field("string")
  name: string = "";

  @Field("date")
  timestamp: Date = new Date();

  @Field("integer")
  expectedEvents: number = 0;

  @Field("json")
  meta: Record<string, unknown> = {};

  @Field("string")
  @Nullable()
  previousId: string | null = null;

  @Field("integer")
  version: number = 0;

  @CreateDateField()
  createdAt: Date = new Date();
}
