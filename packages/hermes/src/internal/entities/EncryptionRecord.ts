import {
  CreateDateField,
  Entity,
  Field,
  Index,
  Namespace,
  Nullable,
  PrimaryKeyField,
  Unique,
} from "@lindorm/proteus";

@Namespace("hermes")
@Unique<typeof EncryptionRecord>(["aggregateId", "aggregateName", "aggregateNamespace"])
@Entity({ name: "encryption" })
export class EncryptionRecord {
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
  public keyId: string = "";

  @Field("string")
  public keyAlgorithm: string = "";

  @Field("string")
  @Nullable()
  public keyCurve: string | null = null;

  @Field("string")
  public keyEncryption: string = "";

  @Field("string")
  public keyType: string = "";

  @Field("text")
  public privateKey: string = "";

  @Field("text")
  public publicKey: string = "";

  @CreateDateField()
  public createdAt: Date = new Date();
}
