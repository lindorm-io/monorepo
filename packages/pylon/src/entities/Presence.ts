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
  id!: string;

  @Field("string")
  room!: string;

  @Field("string")
  socketId!: string;

  @Field("string")
  userId!: string;

  @Field("timestamp")
  joinedAt!: Date;

  @ExpiryDateField()
  expiresAt!: Date | null;
}
