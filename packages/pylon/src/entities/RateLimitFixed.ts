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
export class RateLimitFixed {
  @PrimaryKeyField()
  id!: string;

  @Default(0)
  @Field("integer")
  count!: number;

  @Field("timestamp")
  windowStart!: Date;

  @ExpiryDateField()
  expiresAt!: Date | null;
}
