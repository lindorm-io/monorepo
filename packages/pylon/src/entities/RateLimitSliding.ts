import {
  Default,
  Entity,
  ExpiryDateField,
  Field,
  Namespace,
  PrimaryKeyField,
} from "@lindorm/proteus";

@Namespace("pylon")
@Entity()
export class RateLimitSliding {
  @PrimaryKeyField()
  id!: string;

  @Default([])
  @Field("array", { arrayType: "timestamp" })
  timestamps!: Array<Date>;

  @ExpiryDateField()
  expiresAt!: Date | null;
}
