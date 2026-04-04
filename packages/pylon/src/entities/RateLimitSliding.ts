import {
  Default,
  Entity,
  ExpiryDateField,
  Field,
  Namespace,
  PrimaryKeyField,
} from "@lindorm/proteus";

@Namespace("pylon")
@Entity({ name: "rate_limit_sliding" })
export class RateLimitSliding {
  @PrimaryKeyField()
  public id!: string;

  @Default([])
  @Field("array", { arrayType: "timestamp" })
  public timestamps!: Array<Date>;

  @ExpiryDateField()
  public expiresAt!: Date | null;
}
