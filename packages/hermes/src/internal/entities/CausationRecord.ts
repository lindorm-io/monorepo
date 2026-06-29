import {
  CreateDateField,
  Entity,
  ExpiryDateField,
  Field,
  Max,
  Namespace,
  PrimaryKey,
} from "@lindorm/proteus";

@Namespace("hermes")
@Entity({ name: "causation" })
export class CausationRecord {
  @PrimaryKey()
  @Field("string")
  @Max(128)
  ownerId: string = "";

  @PrimaryKey()
  @Field("string")
  @Max(128)
  ownerName: string = "";

  @PrimaryKey()
  @Field("string")
  @Max(64)
  causationId: string = "";

  @ExpiryDateField()
  expiresAt: Date | null = null;

  @CreateDateField()
  createdAt: Date = new Date();
}
