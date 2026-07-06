import type { ConduitResponse } from "@lindorm/conduit";
import {
  CreateDateField,
  Entity,
  ExpiryDateField,
  Field,
  Namespace,
  PrimaryKeyField,
  UpdateDateField,
  VersionField,
} from "@lindorm/proteus";

@Namespace("pylon")
@Entity()
export class ConduitCachedResponse {
  @PrimaryKeyField("string")
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @ExpiryDateField()
  expiresAt!: Date | null;

  @Field("json")
  payload!: ConduitResponse;
}
