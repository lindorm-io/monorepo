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
  aggregateId: string = "";

  @PrimaryKey()
  @Field("string")
  @Max(128)
  aggregateName: string = "";

  @PrimaryKey()
  @Field("string")
  @Max(64)
  aggregateNamespace: string = "";

  @Field("string")
  keyId: string = "";

  @Field("string")
  keyAlgorithm: string = "";

  @Field("string")
  @Nullable()
  keyCurve: string | null = null;

  @Field("string")
  keyEncryption: string = "";

  @Field("string")
  keyType: string = "";

  @Field("text")
  privateKey: string = "";

  @Field("text")
  publicKey: string = "";

  @CreateDateField()
  createdAt: Date = new Date();
}
