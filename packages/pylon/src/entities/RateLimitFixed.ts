import {
  Default,
  Entity,
  ExpiryDateField,
  Field,
  Namespace,
  PrimaryKeyField,
} from "@lindorm/proteus";

@Namespace("pylon")
@Entity({ name: "rate_limit_fixed" })
export class RateLimitFixed {
  @PrimaryKeyField()
  public id!: string;

  @Default(0)
  @Field("integer")
  public count!: number;

  @Field("timestamp")
  public windowStart!: Date;

  @ExpiryDateField()
  public expiresAt!: Date | null;
}
