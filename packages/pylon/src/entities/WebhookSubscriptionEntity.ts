import {
  ClientCredentialsAuthLocation,
  ClientCredentialsContentType,
} from "@lindorm/conduit";
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryKeyColumn,
  PrimarySource,
  UpdateDateColumn,
  VersionColumn,
} from "@lindorm/entity";
import { Dict } from "@lindorm/types";
import { WebhookAuth } from "../enums";
import { IWebhookSubscription } from "../interfaces";

export abstract class WebhookSubscriptionEntity implements IWebhookSubscription {
  @PrimaryKeyColumn()
  public readonly id!: string;

  @VersionColumn()
  public readonly version!: number;

  @CreateDateColumn()
  public readonly createdAt!: Date;

  @UpdateDateColumn()
  public updatedAt!: Date;

  @Column("enum", { enum: WebhookAuth })
  public auth!: WebhookAuth;

  @Column("string")
  public readonly event!: string;

  @Column("object")
  public headers!: Dict<string>;

  @Column("string")
  public readonly ownerId!: string;

  @Column("url")
  public url!: string;

  // auth headers

  @Column("object")
  public authHeaders!: Dict<string>;

  // basic auth

  @Column("string", { nullable: true })
  public username!: string | null;

  @Column("string", { nullable: true })
  public password!: string | null;

  // client credentials

  @Column("string", { nullable: true })
  public audience!: string | null;

  @Column("string", { nullable: true })
  public authLocation!: ClientCredentialsAuthLocation | null;

  @Column("string", { nullable: true })
  public clientId!: string | null;

  @Column("string", { nullable: true })
  public clientSecret!: string | null;

  @Column("string", { nullable: true })
  public contentType!: ClientCredentialsContentType | null;

  @Column("string", { nullable: true })
  public issuer!: string | null;

  @Column("array", { fallback: [] })
  public scope!: Array<string>;

  @Column("url", { nullable: true })
  public tokenUri!: string | null;
}

@Entity()
@PrimarySource("MnemosSource")
export class MnemosWebhookSubscriptionEntity extends WebhookSubscriptionEntity {}

@Entity()
@PrimarySource("MongoSource")
export class MongoWebhookSubscriptionEntity extends WebhookSubscriptionEntity {}

@Entity()
@PrimarySource("RedisSource")
export class RedisWebhookSubscriptionEntity extends WebhookSubscriptionEntity {}
