import {
  CreateDateField,
  Entity,
  Field,
  Max,
  Namespace,
  Nullable,
  PrimaryKey,
} from "@lindorm/proteus";

@Namespace("hermes")
@Entity({ name: "encryption" })
export class EncryptionRecord {
  @PrimaryKey()
  @Field("string")
  @Max(128)
  public aggregateId: string = "";

  @PrimaryKey()
  @Field("string")
  @Max(128)
  public aggregateName: string = "";

  @PrimaryKey()
  @Field("string")
  @Max(64)
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
