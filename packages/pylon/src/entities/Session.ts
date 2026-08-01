import {
  Entity,
  ExpiryDateField,
  Field,
  Namespace,
  Nullable,
  PrimaryKeyField,
} from "@lindorm/proteus";
import type { Scope } from "@lindorm/openid";
import type { IPylonSession } from "../interfaces/index.js";

@Namespace("pylon")
@Entity()
export class Session implements IPylonSession {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  accessToken!: string;

  @ExpiryDateField()
  expiresAt!: Date | null;

  @Nullable()
  @Field("string")
  idToken?: string;

  @Field("timestamp")
  issuedAt!: Date;

  @Nullable()
  @Field("string")
  refreshToken?: string;

  @Field("array", { arrayType: "string" })
  scope!: Array<Scope>;

  @Field("string")
  subject!: string;
}
