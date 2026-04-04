import { Entity, Field, Namespace, Nullable, PrimaryKeyField } from "@lindorm/proteus";
import { OpenIdScope } from "@lindorm/types";
import { IPylonSession } from "../interfaces";

@Namespace("pylon")
@Entity({ name: "session" })
export class Session implements IPylonSession {
  @PrimaryKeyField()
  public id!: string;

  @Field("string")
  public accessToken!: string;

  @Field("integer")
  public expiresAt!: number;

  @Nullable()
  @Field("string")
  public idToken?: string;

  @Field("integer")
  public issuedAt!: number;

  @Nullable()
  @Field("string")
  public refreshToken?: string;

  @Field("array", { arrayType: "string" })
  public scope!: Array<OpenIdScope | string>;

  @Field("string")
  public subject!: string;
}
