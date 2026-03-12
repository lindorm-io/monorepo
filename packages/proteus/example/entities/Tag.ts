import { Entity, Field, PrimaryKeyField, Unique } from "../../src";

@Entity()
export class Tag {
  @PrimaryKeyField()
  public id!: string;

  @Field("string")
  @Unique()
  public label!: string;
}
