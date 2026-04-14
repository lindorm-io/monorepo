import {
  KryptosAlgorithm,
  KryptosCurve,
  KryptosDB,
  KryptosEncryption,
  KryptosOperation,
  KryptosType,
  KryptosUse,
} from "@lindorm/kryptos";
import {
  CreateDateField,
  Eager,
  EmbeddedList,
  Entity,
  ExpiryDateField,
  Field,
  Index,
  Namespace,
  Nullable,
  PrimaryKeyField,
} from "@lindorm/proteus";

@Namespace("pylon")
@Entity({ name: "kryptos" })
export class Kryptos implements KryptosDB {
  @PrimaryKeyField()
  public id!: string;

  @CreateDateField()
  public createdAt!: Date;

  @Field("timestamp")
  public notBefore!: Date;

  @ExpiryDateField()
  public expiresAt!: Date;

  @Field("string")
  public algorithm!: KryptosAlgorithm;

  @Field("string")
  public type!: KryptosType;

  @Field("string")
  public use!: KryptosUse;

  @Nullable()
  @Field("string")
  public curve!: KryptosCurve | null;

  @Nullable()
  @Field("string")
  public encryption!: KryptosEncryption | null;

  @Eager()
  @EmbeddedList("string")
  public operations!: Array<KryptosOperation>;

  @Nullable()
  @Field("text")
  public privateKey!: string | null;

  @Nullable()
  @Field("text")
  public publicKey!: string | null;

  @Nullable()
  @Eager()
  @EmbeddedList("string")
  public certificateChain!: Array<string> | null;

  @Nullable()
  @Field("string")
  public certificateThumbprint!: string | null;

  @Index()
  @Nullable()
  @Field("string")
  public issuer!: string | null;

  @Index()
  @Nullable()
  @Field("url")
  public jwksUri!: string | null;

  @Index()
  @Field("boolean")
  public isExternal!: boolean;

  @Index()
  @Nullable()
  @Field("string")
  public ownerId!: string | null;

  @Index()
  @Nullable()
  @Field("string")
  public purpose!: string | null;

  @Field("boolean")
  public hidden!: boolean;
}
