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
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Enum(WebhookAuth)
  @Field("enum")
  auth!: WebhookAuth;

  @Field("string")
  event!: string;

  @Default(WebhookMethod.Post)
  @Enum(WebhookMethod)
  @Field("enum")
  method!: WebhookMethod;

  @Field("json")
  headers!: Dict<string>;

  @Field("string")
  ownerId!: string;

  @Nullable()
  @Field("string")
  tenantId!: string | null;

  @Field("url")
  url!: string;

  // auth headers

  @Field("json")
  authHeaders!: Dict<string>;

  // basic auth

  @Nullable()
  @Field("string")
  username!: string | null;

  @Nullable()
  @Field("string")
  password!: string | null;

  // client credentials

  @Nullable()
  @Field("string")
  audience!: string | null;

  @Nullable()
  @Field("string")
  authLocation!: ClientCredentialsAuthLocation | null;

  @Nullable()
  @Field("string")
  clientId!: string | null;

  @Nullable()
  @Field("string")
  clientSecret!: string | null;

  @Nullable()
  @Field("string")
  contentType!: ClientCredentialsContentType | null;

  @Nullable()
  @Field("string")
  issuer!: string | null;

  @Default([])
  @Field("array", { arrayType: "string" })
  scope!: Array<string>;

  @Nullable()
  @Field("url")
  tokenUri!: string | null;

  // error tracking

  @Default(0)
  @Field("integer")
  errorCount!: number;

  @Nullable()
  @Field("timestamp")
  lastErrorAt!: Date | null;

  @Nullable()
  @Field("timestamp")
  suspendedAt!: Date | null;
}
