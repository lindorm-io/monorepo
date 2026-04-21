import { Entity, Field, PrimaryKeyField, Unique } from "../../src/index.js";

@Entity()
export class Tag {
  @PrimaryKeyField()
  public id!: string;

  @Field("string")
  @Unique()
  public label!: string;
}
