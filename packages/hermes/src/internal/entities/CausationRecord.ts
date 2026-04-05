import {
  CreateDateField,
  Entity,
  ExpiryDateField,
  Field,
  Index,
  Namespace,
  PrimaryKeyField,
  Unique,
} from "@lindorm/proteus";

@Namespace("hermes")
@Unique<typeof CausationRecord>(["ownerId", "ownerName", "causationId"])
@Entity({ name: "causation" })
export class CausationRecord {
  @PrimaryKeyField()
  public id: string = "";

  @Field("string")
  @Index()
  public ownerId: string = "";

  @Field("string")
  public ownerName: string = "";

  @Field("string")
  public causationId: string = "";

  @ExpiryDateField()
  public expiresAt: Date | null = null;

  @CreateDateField()
  public createdAt: Date = new Date();
}
