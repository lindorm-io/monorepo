import {
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
import { Dict } from "@lindorm/types";
import { WebhookAuth } from "../enums";
import { IWebhookSubscription } from "../interfaces";

@Namespace("pylon")
@Entity({ name: "webhook_subscription" })
export class WebhookSubscriptionEntity implements IWebhookSubscription {
  @PrimaryKeyField()
  public id!: string;

  @VersionField()
  public version!: number;

  @CreateDateField()
  public createdAt!: Date;

  @UpdateDateField()
  public updatedAt!: Date;

  @Enum(WebhookAuth)
  @Field("string")
  public auth!: WebhookAuth;

  @Field("string")
  public event!: string;

  @Field("json")
  public headers!: Dict<string>;

  @Field("string")
  public ownerId!: string;

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
}
