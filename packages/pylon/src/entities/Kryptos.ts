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
  Entity,
  ExpiryDateField,
  Field,
  Namespace,
  Nullable,
  PrimaryKeyField,
  UpdateDateField,
  VersionField,
} from "@lindorm/proteus";

@Namespace("pylon")
@Entity({ name: "kryptos" })
export class Kryptos implements KryptosDB {
  @PrimaryKeyField()
  public id!: string;

  @VersionField()
  public version!: number;

  @CreateDateField()
  public createdAt!: Date;

  @UpdateDateField()
  public updatedAt!: Date;

  @ExpiryDateField()
  public expiresAt!: Date | null;

  @Field("string")
  public algorithm!: KryptosAlgorithm;

  @Nullable()
  @Field("string")
  public curve!: KryptosCurve | null;

  @Nullable()
  @Field("string")
  public encryption!: KryptosEncryption | null;

  @Field("boolean")
  public hidden!: boolean;

  @Field("boolean")
  public isExternal!: boolean;

  @Nullable()
  @Field("string")
  public issuer!: string | null;

  @Nullable()
  @Field("url")
  public jwksUri!: string | null;

  @Field("timestamp")
  public notBefore!: Date;

  @Field("array", { arrayType: "string" })
  public operations!: Array<KryptosOperation>;

  @Nullable()
  @Field("string")
  public ownerId!: string | null;

  @Nullable()
  @Field("string")
  public privateKey!: string | null;

  @Nullable()
  @Field("string")
  public publicKey!: string | null;

  @Nullable()
  @Field("string")
  public purpose!: string | null;

  @Field("string")
  public type!: KryptosType;

  @Field("string")
  public use!: KryptosUse;
}
