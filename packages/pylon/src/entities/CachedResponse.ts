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

export type CachedResponsePayload = {
  status: number;
  body: unknown;
  etag: string;
  storedAt: number;
};

@Namespace("pylon")
@Entity()
export class CachedResponse {
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
  payload!: CachedResponsePayload;
}
