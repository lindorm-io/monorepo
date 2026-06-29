import type {
  KryptosAlgorithm,
  KryptosCurve,
  KryptosDB,
  KryptosEncryption,
  KryptosOperation,
  KryptosType,
  KryptosUse,
} from "@lindorm/kryptos";
import {
  AppendOnly,
  CreateDateField,
  Eager,
  EmbeddedList,
  Encrypted,
  Entity,
  Field,
  Generated,
  Index,
  Namespace,
  Nullable,
  PrimaryKeyField,
} from "@lindorm/proteus";

@Namespace("pylon")
@AppendOnly()
@Entity()
export class Kryptos implements KryptosDB {
  @PrimaryKeyField()
  @Generated("lindorm_id", { namespace: "key", length: 16 })
  id!: string;

  @CreateDateField()
  createdAt!: Date;

  @Field("timestamp")
  notBefore!: Date;

  @Field("timestamp")
  expiresAt!: Date;

  @Field("string")
  algorithm!: KryptosAlgorithm;

  @Field("string")
  type!: KryptosType;

  @Field("string")
  use!: KryptosUse;

  @Nullable()
  @Field("string")
  curve!: KryptosCurve | null;

  @Nullable()
  @Field("string")
  encryption!: KryptosEncryption | null;

  @Eager()
  @EmbeddedList("string")
  operations!: Array<KryptosOperation>;

  @Encrypted({ purpose: "pylon:kek" })
  @Nullable()
  @Field("text")
  privateKey!: string | null;

  @Nullable()
  @Field("text")
  publicKey!: string | null;

  @Eager()
  @EmbeddedList("string")
  certificateChain!: Array<string>;

  @Index()
  @Nullable()
  @Field("string")
  issuer!: string | null;

  @Index()
  @Nullable()
  @Field("url")
  jwksUri!: string | null;

  @Index()
  @Field("boolean")
  isExternal!: boolean;

  @Index()
  @Nullable()
  @Field("string")
  ownerId!: string | null;

  @Index()
  @Nullable()
  @Field("string")
  purpose!: string | null;

  @Field("boolean")
  hidden!: boolean;
}
