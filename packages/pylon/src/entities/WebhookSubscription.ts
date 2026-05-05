import type {
  ClientCredentialsAuthLocation,
  ClientCredentialsContentType,
} from "@lindorm/conduit";
import {
  CreateDateField,
  Default,
  Entity,
  Enum,
  Field,
  Namespace,
  Nullable,
  PrimaryKeyField,
  UpdateDateField,
  VersionField,
} from "@lindorm/proteus";
import type { Dict } from "@lindorm/types";
import { WebhookAuth, WebhookMethod } from "../enums/index.js";
import type { IWebhookSubscription } from "../interfaces/index.js";

@Namespace("pylon")
@Entity()
export class WebhookSubscription implements IWebhookSubscription {
  @PrimaryKeyField()
  public id!: string;

  @VersionField()
  public version!: number;

  @CreateDateField()
  public createdAt!: Date;

  @UpdateDateField()
  public updatedAt!: Date;

  @Enum(WebhookAuth)
  @Field("enum")
  public auth!: WebhookAuth;

  @Field("string")
  public event!: string;

  @Default(WebhookMethod.Post)
  @Enum(WebhookMethod)
  @Field("enum")
  public method!: WebhookMethod;

  @Field("json")
  public headers!: Dict<string>;

  @Field("string")
  public ownerId!: string;

  @Nullable()
  @Field("string")
  public tenantId!: string | null;

  @Field("url")
  public url!: string;

  // auth headers

  @Field("json")
  public authHeaders!: Dict<string>;

  // basic auth

  @Nullable()
  @Field("string")
  public username!: string | null;

  @Nullable()
  @Field("string")
  public password!: string | null;

  // client credentials

  @Nullable()
  @Field("string")
  public audience!: string | null;

  @Nullable()
  @Field("string")
  public authLocation!: ClientCredentialsAuthLocation | null;

  @Nullable()
  @Field("string")
  public clientId!: string | null;

  @Nullable()
  @Field("string")
  public clientSecret!: string | null;

  @Nullable()
  @Field("string")
  public contentType!: ClientCredentialsContentType | null;

  @Nullable()
  @Field("string")
  public issuer!: string | null;

  @Default([])
  @Field("array", { arrayType: "string" })
  public scope!: Array<string>;

  @Nullable()
  @Field("url")
  public tokenUri!: string | null;

  // error tracking

  @Default(0)
  @Field("integer")
  public errorCount!: number;

  @Nullable()
  @Field("timestamp")
  public lastErrorAt!: Date | null;

  @Nullable()
  @Field("timestamp")
  public suspendedAt!: Date | null;
}
