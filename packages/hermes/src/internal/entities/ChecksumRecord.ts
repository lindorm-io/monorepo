import {
  AppendOnly,
  CreateDateField,
  Entity,
  Field,
  Index,
  Namespace,
  PrimaryKeyField,
} from "@lindorm/proteus";

@Namespace("hermes")
@AppendOnly()
@Entity({ name: "checksum" })
export class ChecksumRecord {
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
  @Index()
  public eventId: string = "";

  @Field("string")
  public checksum: string = "";

  @CreateDateField()
  public createdAt: Date = new Date();
}
