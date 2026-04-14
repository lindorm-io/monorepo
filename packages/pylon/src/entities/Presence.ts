import {
  Entity,
  ExpiryDateField,
  Field,
  Namespace,
  PrimaryKeyField,
} from "@lindorm/proteus";

@Namespace("pylon")
@Entity()
export class Presence {
  @PrimaryKeyField()
  public id!: string;

  @Field("string")
  public room!: string;

  @Field("string")
  public socketId!: string;

  @Field("string")
  public userId!: string;

  @Field("timestamp")
  public joinedAt!: Date;

  @ExpiryDateField()
  public expiresAt!: Date | null;
}
