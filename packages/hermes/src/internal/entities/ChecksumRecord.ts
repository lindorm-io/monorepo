import {
  AppendOnly,
  CreateDateField,
  Entity,
  Field,
  Index,
  Max,
  Namespace,
  PrimaryKey,
} from "@lindorm/proteus";

@Namespace("hermes")
@AppendOnly()
@Entity({ name: "checksum" })
export class ChecksumRecord {
  @PrimaryKey()
  @Field("string")
  @Max(64)
  eventId: string = "";

  @Field("string")
  @Index()
  aggregateId: string = "";

  @Field("string")
  aggregateName: string = "";

  @Field("string")
  aggregateNamespace: string = "";

  @Field("string")
  checksum: string = "";

  @CreateDateField()
  createdAt: Date = new Date();
}
