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
  public ownerId: string = "";

  @PrimaryKey()
  @Field("string")
  @Max(128)
  public ownerName: string = "";

  @PrimaryKey()
  @Field("string")
  @Max(64)
  public causationId: string = "";

  @ExpiryDateField()
  public expiresAt: Date | null = null;

  @CreateDateField()
  public createdAt: Date = new Date();
}
