import { Column, Entity, PrimaryKeyColumn, PrimarySource } from "@lindorm/entity";
import { OpenIdScope } from "@lindorm/types";
import { IPylonSession } from "../interfaces";

export abstract class SessionEntity implements IPylonSession {
  @PrimaryKeyColumn()
  public readonly id!: string;

  @Column("string")
  public accessToken!: string;

  @Column("integer")
  public expiresAt!: number;

  @Column("string", { nullable: true })
  public idToken?: string;

  @Column("integer")
  public issuedAt!: number;

  @Column("string", { nullable: true })
  public refreshToken?: string;

  @Column("array")
  public scope!: Array<OpenIdScope | string>;

  @Column("string")
  public subject!: string;
}

@Entity()
@PrimarySource("MnemosSource")
export class MnemosSessionEntity extends SessionEntity {}

@Entity()
@PrimarySource("MongoSource")
export class MongoSessionEntity extends SessionEntity {}

@Entity()
@PrimarySource("RedisSource")
export class RedisSessionEntity extends SessionEntity {}
