import {
  Column,
  CreateDateColumn,
  Entity,
  ExpiryDateColumn,
  PrimaryKeyColumn,
  PrimarySource,
  UpdateDateColumn,
  VersionColumn,
} from "@lindorm/entity";
import {
  KryptosAlgorithm,
  KryptosCurve,
  KryptosDB,
  KryptosEncryption,
  KryptosOperation,
  KryptosType,
  KryptosUse,
} from "@lindorm/kryptos";
import { z } from "zod/v4";

export abstract class KryptosEntity implements KryptosDB {
  @PrimaryKeyColumn()
  public readonly id!: string;

  @VersionColumn()
  public readonly version!: number;

  @CreateDateColumn()
  public readonly createdAt!: Date;

  @UpdateDateColumn()
  public updatedAt!: Date;

  @ExpiryDateColumn()
  public expiresAt!: Date | null;

  @Column("string")
  public algorithm!: KryptosAlgorithm;

  @Column("string", { nullable: true })
  public curve!: KryptosCurve | null;

  @Column("string", { nullable: true })
  public encryption!: KryptosEncryption | null;

  @Column("boolean")
  public hidden!: boolean;

  @Column("boolean")
  public isExternal!: boolean;

  @Column("string")
  public issuer!: string | null;

  @Column("string", { nullable: true, schema: z.url() as any })
  public jwksUri!: string | null;

  @Column("date")
  public notBefore!: Date;

  @Column("array", { schema: z.array(z.string()) as any })
  public operations!: Array<KryptosOperation>;

  @Column("string", { nullable: true })
  public ownerId!: string | null;

  @Column("string", { nullable: true })
  public privateKey!: string | null;

  @Column("string", { nullable: true })
  public publicKey!: string | null;

  @Column("string", { nullable: true })
  public purpose!: string | null;

  @Column("string")
  public type!: KryptosType;

  @Column("string")
  public use!: KryptosUse;
}

@Entity()
@PrimarySource("MongoSource")
export class MongoKryptosEntity extends KryptosEntity {}
