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
  public eventId: string = "";

  @Field("string")
  @Index()
  public aggregateId: string = "";

  @Field("string")
  public aggregateName: string = "";

  @Field("string")
  public aggregateNamespace: string = "";

  @Field("string")
  public checksum: string = "";

  @CreateDateField()
  public createdAt: Date = new Date();
}
