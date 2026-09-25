import { Entity, Field, PrimaryKeyField, Unique } from "../../src/index.js";

@Entity()
export class Tag {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  @Unique()
  label!: string;
}
