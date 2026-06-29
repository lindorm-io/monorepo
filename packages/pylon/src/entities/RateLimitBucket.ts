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
  id!: string;

  @Field("integer")
  tokens!: number;

  @Field("timestamp")
  lastRefill!: Date;

  @ExpiryDateField()
  expiresAt!: Date | null;
}
