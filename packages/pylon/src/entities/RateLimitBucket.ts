import {
  Entity,
  ExpiryDateField,
  Field,
  Namespace,
  PrimaryKeyField,
} from "@lindorm/proteus";

@Namespace("pylon")
@Entity()
export class RateLimitBucket {
  @PrimaryKeyField()
  public id!: string;

  @Field("integer")
  public tokens!: number;

  @Field("timestamp")
  public lastRefill!: Date;

  @ExpiryDateField()
  public expiresAt!: Date | null;
}
