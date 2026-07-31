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

  /**
   * The per-aggregate DEK, stored UNWRAPPED by design (crypto-shred material):
   * deleting this row makes the aggregate's encrypted events unrecoverable, which
   * IS the GDPR erasure guarantee. Because the key is plaintext, at-rest
   * CONFIDENTIALITY against a single-store dump holds ONLY when Hermes is
   * configured with a separate `encryptionSource` (routing this record to a
   * different store than the event ciphertext); with the default (same store as
   * EventRecord), erasure is guaranteed but a full dump yields ciphertext + key.
   */
  @Field("text")
  privateKey: string = "";

  @Field("text")
  publicKey: string = "";

  @CreateDateField()
  createdAt: Date = new Date();
}
