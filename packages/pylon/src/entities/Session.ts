import {
  Entity,
  ExpiryDateField,
  Field,
  Namespace,
  Nullable,
  PrimaryKeyField,
} from "@lindorm/proteus";
import type { OpenIdScope } from "@lindorm/types";
import type { IPylonSession } from "../interfaces/index.js";

@Namespace("pylon")
@Entity()
export class Session implements IPylonSession {
  @PrimaryKeyField()
  public id!: string;

  @Field("string")
  public accessToken!: string;

  @ExpiryDateField()
  public expiresAt!: Date | null;

  @Nullable()
  @Field("string")
  public idToken?: string;

  @Field("timestamp")
  public issuedAt!: Date;

  @Nullable()
  @Field("string")
  public refreshToken?: string;

  @Field("array", { arrayType: "string" })
  public scope!: Array<OpenIdScope | string>;

  @Field("string")
  public subject!: string;
}
